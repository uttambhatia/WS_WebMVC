package com.ubs.testmanagement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class ContractManagementService {

    private static final String UPLOADED_SEED_FILE = "contract_management_seed_uploaded.json";
    private static final List<String> LAW_BASE_KEYS = List.of("applicable", "accuracy", "snippet", "page", "country");
    private static final List<String> JURISDICTION_BASE_KEYS = List.of("applicable", "accuracy", "snippet", "page", "risk", "reasoning");
    private static final String GOVERNING_LAW_SECTION_NAME = "Governing Law";
    private static final String JURISDICTION_SECTION_NAME = "Jurisdiction";

    private final Map<String, ContractRecord> store = new ConcurrentHashMap<>();
    private final ObjectMapper mapper = new ObjectMapper();

    public ContractManagementService() {
        seedData();
    }

    public Map<String, Object> search(Map<String, Object> body) {
        int page = intValue(body.get("page"), 0);
        int size = Math.max(1, intValue(body.get("size"), 10));

        String sortBy = stringValue(body.get("sortBy"), "documentName");
        String sortDirection = stringValue(body.get("sortDirection"), "asc");

        boolean enableRemotePaging = boolValue(body.get("enableRemotePaging"), true);
        boolean enableRemoteSorting = boolValue(body.get("enableRemoteSorting"), true);
        boolean enableRemoteFiltering = boolValue(body.get("enableRemoteFiltering"), true);

        Map<String, String> filters = toFilterMap(body.get("filters"));

        List<ContractRecord> records = new ArrayList<>(store.values());

        if (enableRemoteFiltering && !filters.isEmpty()) {
            records = records.stream()
                    .filter(record -> matchesFilters(record, filters))
                    .collect(Collectors.toList());
        }

        if (enableRemoteSorting) {
            Comparator<ContractRecord> comparator = comparatorFor(sortBy);
            if ("desc".equalsIgnoreCase(sortDirection)) {
                comparator = comparator.reversed();
            }
            records.sort(comparator);
        }

        int totalElements = records.size();

        List<Map<String, Object>> content;
        int totalPages;
        if (enableRemotePaging) {
            int fromIndex = Math.min(page * size, totalElements);
            int toIndex = Math.min(fromIndex + size, totalElements);
            content = records.subList(fromIndex, toIndex).stream().map(ContractRecord::toMap).collect(Collectors.toList());
            totalPages = (int) Math.ceil(totalElements / (double) size);
        } else {
            content = records.stream().map(ContractRecord::toMap).collect(Collectors.toList());
            page = 0;
            size = Math.max(1, content.size());
            totalPages = 1;
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("content", content);
        response.put("page", page);
        response.put("size", size);
        response.put("totalElements", totalElements);
        response.put("totalPages", totalPages);
        return response;
    }

    public Map<String, Object> createRecord(Map<String, Object> payload, boolean workflowEnabled, boolean auditingEnabled) {
        ContractRecord record = new ContractRecord();

        record.id = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        record.documentName = stringValue(payload.get("documentName"), "");
        record.documentLink = stringValue(payload.get("documentLink"), "");
        record.clientIdentifier = stringValue(payload.get("clientIdentifier"), "");
        record.cdokType = stringValue(payload.get("cdokType"), "");
        record.editedBy = stringValue(payload.get("editedBy"), "ui-user");
        record.status = stringValue(payload.get("status"), "Draft");
        record.governingLawRows = toGoverningLawRows(payload.get("governingLawRows"));
        record.jurisdictionRows = toJurisdictionRows(payload.get("jurisdictionRows"));
        record.lawSections = toCustomLawSections(payload.get("lawSections"));

        Map<String, Object> governingLawSection = findLawSection(payload.get("lawSections"), GOVERNING_LAW_SECTION_NAME);
        Map<String, Object> jurisdictionSection = findLawSection(payload.get("lawSections"), JURISDICTION_SECTION_NAME);

        if (record.governingLawRows.isEmpty() && governingLawSection != null) {
            record.governingLawRows = toGoverningLawRows(governingLawSection.get("rows"));
        }
        if (record.jurisdictionRows.isEmpty() && jurisdictionSection != null) {
            record.jurisdictionRows = toJurisdictionRows(jurisdictionSection.get("rows"));
        }

        // Backward compatibility: support legacy combined rows payload and split-object payload.
        if (record.governingLawRows.isEmpty() && record.jurisdictionRows.isEmpty()) {
            record.governingLawRows = toLegacyGoverningLawRows(payload.get("governingLawJurisdictionRows"));
            record.jurisdictionRows = toLegacyJurisdictionRows(payload.get("governingLawJurisdictionRows"));
        }

        if (record.governingLawRows.isEmpty()) {
            record.governingLawRows = List.of(normalizeGoverningLaw(Map.of()));
        }
        if (record.jurisdictionRows.isEmpty()) {
            record.jurisdictionRows = List.of(normalizeJurisdiction(Map.of()));
        }

        if (!workflowEnabled) {
            record.status = "Submitted";
        }

        record.auditTrail = new ArrayList<>();
        addAudit(record, auditingEnabled, "CREATE", record.editedBy, "Contract created");

        store.put(record.id, record);
        return record.toMap();
    }

    public Map<String, Object> updateRecord(String id, Map<String, Object> payload, boolean workflowEnabled, boolean auditingEnabled) {
        ContractRecord record = getOrThrow(id);

        if (workflowEnabled && !"Draft".equalsIgnoreCase(record.status)) {
            throw new IllegalStateException("Only Draft records can be edited when workflow is enabled.");
        }

        record.documentName = stringValue(payload.get("documentName"), record.documentName);
        record.documentLink = stringValue(payload.get("documentLink"), record.documentLink);
        record.clientIdentifier = stringValue(payload.get("clientIdentifier"), record.clientIdentifier);
        record.cdokType = stringValue(payload.get("cdokType"), record.cdokType);
        record.editedBy = stringValue(payload.get("editedBy"), record.editedBy);
        record.governingLawRows = toGoverningLawRows(payload.get("governingLawRows"));
        record.jurisdictionRows = toJurisdictionRows(payload.get("jurisdictionRows"));
        record.lawSections = toCustomLawSections(payload.get("lawSections"));

        Map<String, Object> governingLawSection = findLawSection(payload.get("lawSections"), GOVERNING_LAW_SECTION_NAME);
        Map<String, Object> jurisdictionSection = findLawSection(payload.get("lawSections"), JURISDICTION_SECTION_NAME);

        if (record.governingLawRows.isEmpty() && governingLawSection != null) {
            record.governingLawRows = toGoverningLawRows(governingLawSection.get("rows"));
        }
        if (record.jurisdictionRows.isEmpty() && jurisdictionSection != null) {
            record.jurisdictionRows = toJurisdictionRows(jurisdictionSection.get("rows"));
        }

        // Backward compatibility: support legacy combined rows payload and split-object payload.
        if (record.governingLawRows.isEmpty() && record.jurisdictionRows.isEmpty()) {
            record.governingLawRows = toLegacyGoverningLawRows(payload.get("governingLawJurisdictionRows"));
            record.jurisdictionRows = toLegacyJurisdictionRows(payload.get("governingLawJurisdictionRows"));
        }

        if (!workflowEnabled) {
            record.status = "Submitted";
        }

        addAudit(record, auditingEnabled, "EDIT", record.editedBy, "Record fields updated");
        notifyReviewer("Contract " + record.id + " updated by " + record.editedBy);
        return record.toMap();
    }

    public Map<String, Object> submitForReview(String id, boolean confirm, boolean workflowEnabled, boolean auditingEnabled, String actor) {
        ContractRecord record = getOrThrow(id);

        if (!workflowEnabled) {
            record.status = "Submitted";
            addAudit(record, auditingEnabled, "SUBMIT", actor, "Workflow disabled: status set to Submitted");
            notifyReviewer("Contract " + record.id + " submitted by " + actor);
            return record.toMap();
        }

        if (!"Draft".equalsIgnoreCase(record.status)) {
            throw new IllegalStateException("Only Draft can be submitted for review.");
        }

        record.status = confirm ? "In review" : "Draft";
        addAudit(record, auditingEnabled, "SUBMIT", actor,
                confirm ? "Moved to In review" : "Submission cancelled, remains Draft");

        if (confirm) {
            notifyReviewer("Contract " + record.id + " sent for review by " + actor);
        }

        return record.toMap();
    }

    public Map<String, Object> approve(String id, boolean workflowEnabled, boolean auditingEnabled, String actor, String comment) {
        ContractRecord record = getOrThrow(id);

        if (!workflowEnabled) {
            addAudit(record, auditingEnabled, "APPROVE", actor, appendComment("Workflow disabled: approve action logged", comment));
            return record.toMap();
        }

        if ("In review".equalsIgnoreCase(record.status)) {
            record.status = "Approved";
        } else if ("Approved".equalsIgnoreCase(record.status)) {
            record.status = "Completed";
        } else {
            throw new IllegalStateException("Approve is allowed only for In review or Approved.");
        }

        addAudit(record, auditingEnabled, "APPROVE", actor, appendComment("Status moved to " + record.status, comment));
        return record.toMap();
    }

    public Map<String, Object> reject(String id, boolean workflowEnabled, boolean auditingEnabled, String actor, String comment) {
        ContractRecord record = getOrThrow(id);

        if (!workflowEnabled) {
            addAudit(record, auditingEnabled, "REJECT", actor, appendComment("Workflow disabled: reject action logged", comment));
            return record.toMap();
        }

        if (!"In review".equalsIgnoreCase(record.status) && !"Approved".equalsIgnoreCase(record.status)) {
            throw new IllegalStateException("Reject is allowed only for In review or Approved.");
        }

        record.status = "Draft";
        addAudit(record, auditingEnabled, "REJECT", actor, appendComment("Status moved back to Draft", comment));
        return record.toMap();
    }

    private String appendComment(String baseDetail, String comment) {
        if (comment == null || comment.trim().isEmpty()) {
            return baseDetail;
        }
        return baseDetail + " | Comment: " + comment.trim();
    }

    public List<Map<String, Object>> getAuditTrail(String id) {
        ContractRecord record = getOrThrow(id);
        return new ArrayList<>(record.auditTrail);
    }

    public DownloadPayload download(String id, String format) {
        ContractRecord record = getOrThrow(id);
        String normalized = format == null ? "csv" : format.toLowerCase(Locale.ROOT);

        if ("excel".equals(normalized)) {
            return buildExcelDownload(id, record);
        }

        String bodyText = buildReportText(record);
        if ("pdf".equals(normalized)) {
            return buildPdfDownload(id, record);
        }

        return new DownloadPayload(
                "contract-" + id + ".csv",
                "text/csv",
                bodyText.getBytes(StandardCharsets.UTF_8)
        );
    }

    public Map<String, Object> uploadContractsExcel(MultipartFile file) {
        try {
            if (file == null || file.isEmpty()) {
                throw new IllegalArgumentException("Please select a non-empty Excel file.");
            }

            String filename = Objects.toString(file.getOriginalFilename(), "");
            String lowerName = filename.toLowerCase(Locale.ROOT);
            if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
                throw new IllegalArgumentException("Only .xlsx or .xls files are supported.");
            }

            try (InputStream inputStream = file.getInputStream()) {
                List<Map<String, Object>> rows = parseUploadWorkbook(inputStream);
                if (rows.isEmpty()) {
                    throw new IllegalArgumentException("No valid rows found in uploaded Excel file.");
                }

                Path seedPath = writeUploadedSeedJson(rows);
                reloadStoreFromRows(rows, "CREATE", "Uploaded from Excel seed");

                Map<String, Object> response = new LinkedHashMap<>();
                response.put("message", "Contracts uploaded successfully.");
                response.put("recordCount", rows.size());
                response.put("seedJsonPath", seedPath.toString());
                response.put("fallbackUsed", false);
                return response;
            }
        } catch (Exception uploadException) {
            try (InputStream fallbackStream = getClass().getClassLoader().getResourceAsStream("contracts.xlsx")) {
                if (fallbackStream == null) {
                    throw new IllegalStateException("Fallback resource contracts.xlsx not found.", uploadException);
                }

                List<Map<String, Object>> fallbackRows = parseUploadWorkbook(fallbackStream);
                if (fallbackRows.isEmpty()) {
                    throw new IllegalStateException("Fallback resource contracts.xlsx has no valid rows.", uploadException);
                }

                Path fallbackSeedPath = writeUploadedSeedJson(fallbackRows);
                reloadStoreFromRows(fallbackRows, "CREATE", "Loaded from fallback contracts.xlsx");

                Map<String, Object> response = new LinkedHashMap<>();
                response.put("message", "Upload failed. Loaded fallback contracts.xlsx successfully.");
                response.put("recordCount", fallbackRows.size());
                response.put("seedJsonPath", fallbackSeedPath.toString());
                response.put("fallbackUsed", true);
                response.put("uploadError", uploadException.getMessage());
                return response;
            } catch (IOException fallbackException) {
                throw new IllegalStateException("Failed to process fallback resource contracts.xlsx.", fallbackException);
            }
        }
    }

    private String buildReportText(ContractRecord record) {
        List<DownloadSection> sections = buildDownloadSections(record);
        int totalRows = Math.max(1, sections.stream().mapToInt(section -> section.rows().size()).max().orElse(1));

        List<String> topHeader = new ArrayList<>(List.of("Document Name", "Document Link", "Client Identifier", "CDOK Type", "Edited By"));
        List<String> subHeader = new ArrayList<>(List.of("", "", "", "", ""));
        for (DownloadSection section : sections) {
            int count = section.columnKeys().size();
            topHeader.add(section.name());
            for (int index = 1; index < count; index++) {
                topHeader.add("");
            }
            subHeader.addAll(section.columnLabels());
        }

        StringBuilder body = new StringBuilder();
        body.append(toCsvLine(topHeader)).append("\n");
        body.append(toCsvLine(subHeader)).append("\n");

        for (int rowIndex = 0; rowIndex < totalRows; rowIndex++) {
            List<String> rowValues = new ArrayList<>();
            if (rowIndex == 0) {
                rowValues.add(valueOrEmpty(record.documentName));
                rowValues.add(valueOrEmpty(record.documentLink));
                rowValues.add(valueOrEmpty(record.clientIdentifier));
                rowValues.add(valueOrEmpty(record.cdokType));
                rowValues.add(valueOrEmpty(record.editedBy));
            } else {
                rowValues.add("");
                rowValues.add("");
                rowValues.add("");
                rowValues.add("");
                rowValues.add("");
            }

            for (DownloadSection section : sections) {
                Map<String, String> dataRow = rowIndex < section.rows().size() ? section.rows().get(rowIndex) : Map.of();
                for (String key : section.columnKeys()) {
                    rowValues.add(valueOrEmpty(dataRow.get(key)));
                }
            }

            body.append(toCsvLine(rowValues)).append("\n");
        }

        return body.toString();
    }

    private DownloadPayload buildPdfDownload(String id, ContractRecord record) {
        final PDRectangle pageSize = PDRectangle.A4;
        final float margin = 50f;
        final float fontSize = 10f;
        final float leading = 14f;
        final PDFont font = PDType1Font.HELVETICA;

        List<String> lines = buildPdfLines(record);

        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(pageSize);
            document.addPage(page);

            PDPageContentStream contentStream = new PDPageContentStream(document, page);
            float y = pageSize.getHeight() - margin;
            contentStream.beginText();
            contentStream.setFont(font, fontSize);
            contentStream.newLineAtOffset(margin, y);

            float maxTextWidth = pageSize.getWidth() - (2 * margin);
            for (String line : lines) {
                List<String> wrappedLines = wrapPdfLine(line, font, fontSize, maxTextWidth);
                for (String wrappedLine : wrappedLines) {
                    if (y <= margin) {
                        contentStream.endText();
                        contentStream.close();

                        page = new PDPage(pageSize);
                        document.addPage(page);
                        contentStream = new PDPageContentStream(document, page);
                        y = pageSize.getHeight() - margin;
                        contentStream.beginText();
                        contentStream.setFont(font, fontSize);
                        contentStream.newLineAtOffset(margin, y);
                    }

                    contentStream.showText(wrappedLine);
                    contentStream.newLineAtOffset(0, -leading);
                    y -= leading;
                }
            }

            contentStream.endText();
            contentStream.close();

            document.save(output);
            return new DownloadPayload(
                    "contract-" + id + ".pdf",
                    "application/pdf",
                    output.toByteArray()
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to build PDF download", exception);
        }
    }

    private List<String> buildPdfLines(ContractRecord record) {
        List<String> lines = new ArrayList<>();
        lines.add("Contract Detail");
        lines.add("");
        lines.add("Document Name: " + valueOrDash(record.documentName));
        lines.add("Document Link: " + valueOrDash(record.documentLink));
        lines.add("Client Identifier: " + valueOrDash(record.clientIdentifier));
        lines.add("CDOK Type: " + valueOrDash(record.cdokType));
        lines.add("Edited By: " + valueOrDash(record.editedBy));
        lines.add("");

        List<DownloadSection> sections = buildDownloadSections(record);
        for (int sectionIndex = 0; sectionIndex < sections.size(); sectionIndex++) {
            DownloadSection section = sections.get(sectionIndex);
            lines.add(section.name() + ":");
            if (section.rows().isEmpty()) {
                lines.add("  - No rows");
            } else {
                for (int rowIndex = 0; rowIndex < section.rows().size(); rowIndex++) {
                    Map<String, String> row = section.rows().get(rowIndex);
                    StringBuilder detail = new StringBuilder();
                    for (int columnIndex = 0; columnIndex < section.columnKeys().size(); columnIndex++) {
                        if (columnIndex > 0) {
                            detail.append(" | ");
                        }
                        detail.append(section.columnLabels().get(columnIndex))
                                .append(": ")
                                .append(valueOrDash(row.get(section.columnKeys().get(columnIndex))));
                    }
                    lines.add("  [" + (rowIndex + 1) + "] " + detail);
                }
            }

            if (sectionIndex < sections.size() - 1) {
                lines.add("");
            }
        }

        return lines;
    }

    private List<String> wrapPdfLine(String line, PDFont font, float fontSize, float maxWidth) throws IOException {
        if (line == null || line.isEmpty()) {
            return List.of(" ");
        }

        List<String> wrapped = new ArrayList<>();
        String[] words = line.trim().split("\\s+");
        StringBuilder current = new StringBuilder();

        for (String word : words) {
            String candidate = current.length() == 0 ? word : current + " " + word;
            float candidateWidth = font.getStringWidth(candidate) / 1000f * fontSize;
            if (candidateWidth <= maxWidth) {
                current.setLength(0);
                current.append(candidate);
                continue;
            }

            if (current.length() > 0) {
                wrapped.add(current.toString());
                current.setLength(0);
                current.append(word);
            } else {
                wrapped.add(word);
            }
        }

        if (current.length() > 0) {
            wrapped.add(current.toString());
        }

        return wrapped.isEmpty() ? List.of(" ") : wrapped;
    }

    private String valueOrDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private DownloadPayload buildExcelDownload(String id, ContractRecord record) {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Contract Report");
            List<DownloadSection> sections = buildDownloadSections(record);

            CellStyle headerStyle = workbook.createCellStyle();
            Font boldFont = workbook.createFont();
            boldFont.setBold(true);
            headerStyle.setFont(boldFont);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            CellStyle mergedHeaderStyle = workbook.createCellStyle();
            mergedHeaderStyle.cloneStyleFrom(headerStyle);
            mergedHeaderStyle.setAlignment(HorizontalAlignment.CENTER);

            // Blue, Accent 1, 40% Lighter = #9DC3E6
            XSSFCellStyle glHeaderStyle = (XSSFCellStyle) workbook.createCellStyle();
            glHeaderStyle.cloneStyleFrom(mergedHeaderStyle);
            glHeaderStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 0x9D, (byte) 0xC3, (byte) 0xE6}, null));
            glHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Blue, Accent 1, 80% Lighter = #DEEAF1
            XSSFCellStyle glSubHeaderStyle = (XSSFCellStyle) workbook.createCellStyle();
            glSubHeaderStyle.cloneStyleFrom(headerStyle);
            glSubHeaderStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 0xDE, (byte) 0xEA, (byte) 0xF1}, null));
            glSubHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Gold, Accent 4, 60% Lighter = #FFE699
            XSSFCellStyle jurHeaderStyle = (XSSFCellStyle) workbook.createCellStyle();
            jurHeaderStyle.cloneStyleFrom(mergedHeaderStyle);
            jurHeaderStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 0xFF, (byte) 0xE6, (byte) 0x99}, null));
            jurHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Gold, Accent 4, 80% Lighter = #FFF2CC
            XSSFCellStyle jurSubHeaderStyle = (XSSFCellStyle) workbook.createCellStyle();
            jurSubHeaderStyle.cloneStyleFrom(headerStyle);
            jurSubHeaderStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 0xFF, (byte) 0xF2, (byte) 0xCC}, null));
            jurSubHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // White, Background 1, Darker 25% = #BFBFBF
            XSSFCellStyle columnHeaderStyle = (XSSFCellStyle) workbook.createCellStyle();
            columnHeaderStyle.cloneStyleFrom(headerStyle);
            columnHeaderStyle.setAlignment(HorizontalAlignment.CENTER);
            columnHeaderStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 0xBF, (byte) 0xBF, (byte) 0xBF}, null));
            columnHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            XSSFCellStyle customHeaderStyle = (XSSFCellStyle) workbook.createCellStyle();
            customHeaderStyle.cloneStyleFrom(mergedHeaderStyle);
            customHeaderStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 0xE3, (byte) 0xE8, (byte) 0xEF}, null));
            customHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            XSSFCellStyle customSubHeaderStyle = (XSSFCellStyle) workbook.createCellStyle();
            customSubHeaderStyle.cloneStyleFrom(headerStyle);
            customSubHeaderStyle.setFillForegroundColor(new XSSFColor(new byte[]{(byte) 0xF3, (byte) 0xF6, (byte) 0xFA}, null));
            customSubHeaderStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Row headerRow = sheet.createRow(0);
            createCell(headerRow, 0, "Document Name", columnHeaderStyle);
            createCell(headerRow, 1, "Document Link", columnHeaderStyle);
            createCell(headerRow, 2, "Client Identifier", columnHeaderStyle);
            createCell(headerRow, 3, "CDOK Type", columnHeaderStyle);
            createCell(headerRow, 4, "Edited By", columnHeaderStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 1, 0, 0));
            sheet.addMergedRegion(new CellRangeAddress(0, 1, 1, 1));
            sheet.addMergedRegion(new CellRangeAddress(0, 1, 2, 2));
            sheet.addMergedRegion(new CellRangeAddress(0, 1, 3, 3));
            sheet.addMergedRegion(new CellRangeAddress(0, 1, 4, 4));

            Row subHeaderRow = sheet.createRow(1);

            int sectionStartColumn = 5;
            for (DownloadSection section : sections) {
                XSSFCellStyle groupHeaderStyle;
                XSSFCellStyle subSectionHeaderStyle;
                String normalized = normalizeSectionName(section.name());
                if (normalized.equals(normalizeSectionName(GOVERNING_LAW_SECTION_NAME))) {
                    groupHeaderStyle = glHeaderStyle;
                    subSectionHeaderStyle = glSubHeaderStyle;
                } else if (normalized.equals(normalizeSectionName(JURISDICTION_SECTION_NAME))) {
                    groupHeaderStyle = jurHeaderStyle;
                    subSectionHeaderStyle = jurSubHeaderStyle;
                } else {
                    groupHeaderStyle = customHeaderStyle;
                    subSectionHeaderStyle = customSubHeaderStyle;
                }

                int columnCount = Math.max(1, section.columnKeys().size());
                int sectionEndColumn = sectionStartColumn + columnCount - 1;

                createCell(headerRow, sectionStartColumn, section.name(), groupHeaderStyle);
                if (sectionEndColumn > sectionStartColumn) {
                    sheet.addMergedRegion(new CellRangeAddress(0, 0, sectionStartColumn, sectionEndColumn));
                }

                for (int columnOffset = 0; columnOffset < columnCount; columnOffset++) {
                    String label = columnOffset < section.columnLabels().size() ? section.columnLabels().get(columnOffset) : "";
                    createCell(subHeaderRow, sectionStartColumn + columnOffset, label, subSectionHeaderStyle);
                }

                sectionStartColumn = sectionEndColumn + 1;
            }

            Row detailsRow = sheet.createRow(2);
            createCell(detailsRow, 0, record.documentName, null);
            createCell(detailsRow, 1, record.documentLink, null);
            createCell(detailsRow, 2, record.clientIdentifier, null);
            createCell(detailsRow, 3, record.cdokType, null);
            createCell(detailsRow, 4, record.editedBy, null);

            int totalRows = Math.max(1, sections.stream().mapToInt(section -> section.rows().size()).max().orElse(1));
            for (int rowIndex = 0; rowIndex < totalRows; rowIndex++) {
                Row dataRow = sheet.getRow(rowIndex + 2);
                if (dataRow == null) {
                    dataRow = sheet.createRow(rowIndex + 2);
                }

                if (rowIndex > 0) {
                    createCell(dataRow, 0, "", null);
                    createCell(dataRow, 1, "", null);
                    createCell(dataRow, 2, "", null);
                    createCell(dataRow, 3, "", null);
                    createCell(dataRow, 4, "", null);
                }

                int cellColumn = 5;
                for (DownloadSection section : sections) {
                    Map<String, String> sectionRow = rowIndex < section.rows().size() ? section.rows().get(rowIndex) : Map.of();
                    for (String key : section.columnKeys()) {
                        createCell(dataRow, cellColumn++, sectionRow.getOrDefault(key, ""), null);
                    }
                }
            }

            int totalColumns = 5 + sections.stream().mapToInt(section -> section.columnKeys().size()).sum();
            applyExcelColumnWidths(sheet, totalColumns, sections);

            workbook.write(output);
            return new DownloadPayload(
                    "contract-" + id + ".xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    output.toByteArray()
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to build Excel download", exception);
        }
    }

    private void createCell(Row row, int columnIndex, String value, CellStyle style) {
        Cell cell = row.createCell(columnIndex);
        cell.setCellValue(value == null ? "" : value);
        XSSFCellStyle cellStyle = style != null
                ? (XSSFCellStyle) style
                : (XSSFCellStyle) row.getSheet().getWorkbook().createCellStyle();
        cellStyle.setBorderTop(BorderStyle.THIN);
        cellStyle.setBorderBottom(BorderStyle.THIN);
        cellStyle.setBorderLeft(BorderStyle.THIN);
        cellStyle.setBorderRight(BorderStyle.THIN);
        cell.setCellStyle(cellStyle);
    }

    private void applyExcelColumnWidths(Sheet sheet, int totalColumns, List<DownloadSection> sections) {
        // POI width unit: 1/256th of a character.
        sheet.setColumnWidth(0, 22 * 256); // Document Name
        sheet.setColumnWidth(1, 30 * 256); // Document Link
        sheet.setColumnWidth(2, 20 * 256); // Client Identifier
        sheet.setColumnWidth(3, 16 * 256); // CDOK Type
        sheet.setColumnWidth(4, 16 * 256); // Edited By

        int column = 5;
        for (DownloadSection section : sections) {
            for (String label : section.columnLabels()) {
                String normalized = normalizeSectionName(label);
                int width = switch (normalized) {
                    case "snippet", "reasoning", "definition" -> 34 * 256;
                    case "page" -> 9 * 256;
                    case "accuracy" -> 12 * 256;
                    default -> 14 * 256;
                };
                sheet.setColumnWidth(column++, width);
            }
        }

        for (int current = column; current < totalColumns; current++) {
            sheet.setColumnWidth(current, 14 * 256);
        }
    }

    private List<DownloadSection> buildDownloadSections(ContractRecord record) {
        List<Map<String, Object>> allSections = new ArrayList<>();
        allSections.add(toSpecialLawSection(GOVERNING_LAW_SECTION_NAME, record.governingLawRows, LAW_BASE_KEYS));
        allSections.add(toSpecialLawSection(JURISDICTION_SECTION_NAME, record.jurisdictionRows, JURISDICTION_BASE_KEYS));
        if (record.lawSections != null) {
            allSections.addAll(record.lawSections.stream().map(this::normalizeLawSection).collect(Collectors.toList()));
        }

        List<DownloadSection> sections = new ArrayList<>();
        for (Map<String, Object> section : allSections) {
            String sectionName = Objects.toString(section.get("name"), "");
            List<Map<String, String>> columns = toLawSectionColumns(section.get("columns"));
            List<Map<String, String>> rows = toLawSectionRows(section.get("rows"), columns);

            List<String> baseKeys = normalizeSectionName(sectionName).equals(normalizeSectionName(JURISDICTION_SECTION_NAME))
                    ? JURISDICTION_BASE_KEYS
                    : LAW_BASE_KEYS;

            List<String> keys = new ArrayList<>(baseKeys);
            for (Map<String, String> column : columns) {
                String key = column.getOrDefault("key", "");
                if (!key.isEmpty() && !keys.contains(key)) {
                    keys.add(key);
                }
            }

            for (Map<String, String> row : rows) {
                for (String key : row.keySet()) {
                    if (!keys.contains(key)) {
                        keys.add(key);
                    }
                }
            }

            Map<String, String> customLabels = new LinkedHashMap<>();
            for (Map<String, String> column : columns) {
                String key = column.getOrDefault("key", "");
                String label = column.getOrDefault("label", "");
                if (!key.isEmpty() && !label.isEmpty()) {
                    customLabels.put(key, label);
                }
            }

            List<String> labels = keys.stream()
                    .map(key -> customLabels.getOrDefault(key, humanizeColumnLabel(key)))
                    .collect(Collectors.toCollection(ArrayList::new));

            sections.add(new DownloadSection(sectionName, keys, labels, rows));
        }

        return sections;
    }

    private String toCsvLine(List<String> values) {
        return values.stream().map(this::escapeCsv).collect(Collectors.joining(","));
    }

    private String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }

    private boolean matchesFilters(ContractRecord record, Map<String, String> filters) {
        for (Map.Entry<String, String> entry : filters.entrySet()) {
            String filterValue = entry.getValue();
            if (filterValue == null || filterValue.isBlank()) {
                continue;
            }

            String source;
            switch (entry.getKey()) {
                case "documentName" -> source = record.documentName;
                case "documentLink" -> source = record.documentLink;
                case "clientIdentifier" -> source = record.clientIdentifier;
                case "cdokType" -> source = record.cdokType;
                case "status" -> source = record.status;
                case "editedBy" -> source = record.editedBy;
                default -> source = "";
            }

            if (!source.toLowerCase(Locale.ROOT).contains(filterValue.toLowerCase(Locale.ROOT))) {
                return false;
            }
        }
        return true;
    }

    private Comparator<ContractRecord> comparatorFor(String sortBy) {
        return switch (sortBy) {
            case "documentLink" -> Comparator.comparing(record -> lower(record.documentLink));
            case "clientIdentifier" -> Comparator.comparing(record -> lower(record.clientIdentifier));
            case "cdokType" -> Comparator.comparing(record -> lower(record.cdokType));
            case "status" -> Comparator.comparing(record -> lower(record.status));
            case "editedBy" -> Comparator.comparing(record -> lower(record.editedBy));
            default -> Comparator.comparing(record -> lower(record.documentName));
        };
    }

    private String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private void addAudit(ContractRecord record, boolean auditingEnabled, String action, String actor, String detail) {
        if (!auditingEnabled) {
            return;
        }

        Map<String, Object> auditItem = new LinkedHashMap<>();
        auditItem.put("action", action);
        auditItem.put("performedBy", actor == null || actor.isBlank() ? "system" : actor);
        auditItem.put("detail", detail);
        auditItem.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        record.auditTrail.add(auditItem);
    }

    private void notifyReviewer(String message) {
        // Simple in-memory integration-test friendly notification hook.
        System.out.println("[NOTIFICATION] " + message);
    }

    private List<Map<String, Object>> parseUploadWorkbook(InputStream inputStream) throws IOException {
        try (Workbook workbook = WorkbookFactory.create(inputStream)) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) {
                return List.of();
            }

            DataFormatter formatter = new DataFormatter();
            Row headerRow = sheet.getRow(0);
            Row subHeaderRow = sheet.getRow(1);
            if (headerRow == null) {
                return List.of();
            }

            boolean hasSubHeaders = rowHasAnyValue(subHeaderRow, formatter);
            int maxColumns = Math.max(
                    getMaxColumn(headerRow),
                    hasSubHeaders ? getMaxColumn(subHeaderRow) : -1
            );
            if (maxColumns < 0) {
                return List.of();
            }

            List<ColumnMeta> columns = new ArrayList<>();
            for (int col = 0; col <= maxColumns; col++) {
                String top = hasSubHeaders ? resolveGroupedHeaderValue(sheet, 0, col, formatter) : "";
                String child = hasSubHeaders
                        ? normalizeHeaderLabel(cellValue(subHeaderRow, col, formatter))
                        : normalizeHeaderLabel(cellValue(headerRow, col, formatter));

                if (!hasSubHeaders) {
                    top = "";
                }

                if (child.isEmpty() && !top.isEmpty()) {
                    child = top;
                    top = "";
                }

                if (child.isEmpty() && top.isEmpty()) {
                    continue;
                }

                columns.add(new ColumnMeta(col, top, child));
            }

            int dataStartRow = hasSubHeaders ? 2 : 1;
            List<Map<String, Object>> rows = new ArrayList<>();

            for (int rowIndex = dataStartRow; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null) {
                    continue;
                }

                ParsedUploadRow parsed = parseUploadDataRow(row, columns, formatter);
                if (parsed.isEmpty()) {
                    continue;
                }
                rows.add(parsed.toRecordMap());
            }

            return rows;
        }
    }

    private ParsedUploadRow parseUploadDataRow(Row row, List<ColumnMeta> columns, DataFormatter formatter) {
        ParsedUploadRow parsed = new ParsedUploadRow();

        for (ColumnMeta column : columns) {
            String value = cellValue(row, column.columnIndex(), formatter);
            String normalizedGroup = normalizeHeaderKey(column.groupLabel());
            String normalizedChild = normalizeHeaderKey(column.childLabel());

            if (normalizedGroup.isEmpty()) {
                String directKey = toDirectFieldKey(normalizedChild);
                if (directKey != null) {
                    parsed.directFields.put(directKey, value);
                }
                continue;
            }

            if (isGoverningLawGroup(normalizedGroup)) {
                String key = toGoverningKey(normalizedChild);
                if (key != null) {
                    parsed.governingLaw.put(key, value);
                }
                continue;
            }

            if (isJurisdictionGroup(normalizedGroup)) {
                String key = toJurisdictionKey(normalizedChild);
                if (key != null) {
                    parsed.jurisdiction.put(key, value);
                }
                continue;
            }

            parsed.customSections
                    .computeIfAbsent(column.groupLabel(), ignored -> new CustomSectionAccumulator())
                    .addColumnValue(column.childLabel(), value);
        }

        return parsed;
    }

    private boolean rowHasAnyValue(Row row, DataFormatter formatter) {
        if (row == null) {
            return false;
        }
        int maxCol = getMaxColumn(row);
        for (int col = 0; col <= maxCol; col++) {
            if (!cellValue(row, col, formatter).isBlank()) {
                return true;
            }
        }
        return false;
    }

    private int getMaxColumn(Row row) {
        if (row == null || row.getLastCellNum() <= 0) {
            return -1;
        }
        return row.getLastCellNum() - 1;
    }

    private String resolveGroupedHeaderValue(Sheet sheet, int headerRowIndex, int columnIndex, DataFormatter formatter) {
        Row headerRow = sheet.getRow(headerRowIndex);
        String direct = normalizeHeaderLabel(cellValue(headerRow, columnIndex, formatter));
        if (!direct.isEmpty()) {
            return direct;
        }

        for (CellRangeAddress range : sheet.getMergedRegions()) {
            if (range.getFirstRow() == headerRowIndex
                    && range.getLastRow() == headerRowIndex
                    && columnIndex >= range.getFirstColumn()
                    && columnIndex <= range.getLastColumn()) {
                return normalizeHeaderLabel(cellValue(headerRow, range.getFirstColumn(), formatter));
            }
        }
        return "";
    }

    private String cellValue(Row row, int columnIndex, DataFormatter formatter) {
        if (row == null) {
            return "";
        }
        Cell cell = row.getCell(columnIndex);
        if (cell == null) {
            return "";
        }
        return Objects.toString(formatter.formatCellValue(cell), "").trim();
    }

    private String normalizeHeaderLabel(String value) {
        return Objects.toString(value, "").trim();
    }

    private String normalizeHeaderKey(String value) {
        return Objects.toString(value, "")
                .toLowerCase(Locale.ROOT)
                .replace("&", "and")
                .replaceAll("[^a-z0-9]+", "");
    }

    private boolean isGoverningLawGroup(String normalizedGroup) {
        return normalizedGroup.contains("governinglaw");
    }

    private boolean isJurisdictionGroup(String normalizedGroup) {
        return normalizedGroup.contains("jurisdiction");
    }

    private String toDirectFieldKey(String normalized) {
        return switch (normalized) {
            case "documentname", "contractname", "name" -> "documentName";
            case "documentlink", "doclink", "link" -> "documentLink";
            case "clientidentifier", "clientid", "client" -> "clientIdentifier";
            case "cdoktype", "doctype", "contracttype" -> "cdokType";
            case "editedby", "owner", "assignee" -> "editedBy";
            case "status" -> "status";
            default -> null;
        };
    }

    private String toGoverningKey(String normalized) {
        return switch (normalized) {
            case "applicable" -> "applicable";
            case "accuracy" -> "accuracy";
            case "snippet", "text" -> "snippet";
            case "page", "pageno", "pagenumber" -> "page";
            case "country" -> "country";
            default -> null;
        };
    }

    private String toJurisdictionKey(String normalized) {
        return switch (normalized) {
            case "applicable" -> "applicable";
            case "accuracy" -> "accuracy";
            case "snippet", "text" -> "snippet";
            case "page", "pageno", "pagenumber" -> "page";
            case "risk" -> "risk";
            case "reasoning", "rationale" -> "reasoning";
            default -> null;
        };
    }

    private Path writeUploadedSeedJson(List<Map<String, Object>> rows) throws IOException {
        Path path = Paths.get("src", "main", "resources", UPLOADED_SEED_FILE).toAbsolutePath();
        Files.createDirectories(path.getParent());
        mapper.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), rows);
        return path;
    }

    private void reloadStoreFromRows(List<Map<String, Object>> rows, String auditAction, String auditDetail) {
        store.clear();

        int index = 1;
        for (Map<String, Object> row : rows) {
            String id = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
            ContractRecord record = new ContractRecord();
            record.id = id;
            record.documentName = stringValue(row.get("documentName"), "Contract-" + index + ".docx");
            record.documentLink = stringValue(row.get("documentLink"), "");
            record.clientIdentifier = stringValue(row.get("clientIdentifier"), "");
            record.cdokType = stringValue(row.get("cdokType"), "");
            record.status = stringValue(row.get("status"), "Draft");
            record.editedBy = stringValue(row.get("editedBy"), "upload-user");
            record.governingLawRows = toGoverningLawRows(row.get("governingLawRows"));
            record.jurisdictionRows = toJurisdictionRows(row.get("jurisdictionRows"));
            record.lawSections = toCustomLawSections(row.get("lawSections"));

            Map<String, Object> governingLawSection = findLawSection(row.get("lawSections"), GOVERNING_LAW_SECTION_NAME);
            Map<String, Object> jurisdictionSection = findLawSection(row.get("lawSections"), JURISDICTION_SECTION_NAME);

            if (record.governingLawRows.isEmpty() && governingLawSection != null) {
                record.governingLawRows = toGoverningLawRows(governingLawSection.get("rows"));
            }
            if (record.jurisdictionRows.isEmpty() && jurisdictionSection != null) {
                record.jurisdictionRows = toJurisdictionRows(jurisdictionSection.get("rows"));
            }

            if (record.governingLawRows.isEmpty()) {
                record.governingLawRows = List.of(normalizeGoverningLaw(Map.of()));
            }
            if (record.jurisdictionRows.isEmpty()) {
                record.jurisdictionRows = List.of(normalizeJurisdiction(Map.of()));
            }

            record.auditTrail = new ArrayList<>();
            addAudit(record, true, auditAction, "system", auditDetail);
            store.put(id, record);
            index++;
        }
    }

    private Map<String, String> toFilterMap(Object raw) {
        if (!(raw instanceof Map<?, ?> rawMap)) {
            return Map.of();
        }

        Map<String, String> result = new LinkedHashMap<>();
        rawMap.forEach((key, value) -> result.put(String.valueOf(key), Objects.toString(value, "")));
        return result;
    }

    private List<Map<String, Object>> toCombinedRows(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return new ArrayList<>();
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("governingLaw", normalizeGoverningLaw(map.get("governingLaw")));
                row.put("jurisdiction", normalizeJurisdiction(map.get("jurisdiction")));
                rows.add(row);
            }
        }

        return rows;
    }

    private List<Map<String, String>> toLegacyGoverningLawRows(Object raw) {
        if (raw instanceof Map<?, ?> map) {
            return toGoverningLawRows(map.get("governingLawRows"));
        }

        List<Map<String, Object>> combined = toCombinedRows(raw);
        return combined.stream()
                .map(item -> normalizeGoverningLaw(item.get("governingLaw")))
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private List<Map<String, String>> toLegacyJurisdictionRows(Object raw) {
        if (raw instanceof Map<?, ?> map) {
            return toJurisdictionRows(map.get("jurisdictionRows"));
        }

        List<Map<String, Object>> combined = toCombinedRows(raw);
        return combined.stream()
                .map(item -> normalizeJurisdiction(item.get("jurisdiction")))
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private List<Map<String, String>> toGoverningLawRows(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return new ArrayList<>();
        }

        List<Map<String, String>> rows = new ArrayList<>();
        for (Object item : list) {
            rows.add(normalizeGoverningLaw(item));
        }
        return rows;
    }

    private List<Map<String, String>> toJurisdictionRows(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return new ArrayList<>();
        }

        List<Map<String, String>> rows = new ArrayList<>();
        for (Object item : list) {
            rows.add(normalizeJurisdiction(item));
        }
        return rows;
    }

    private List<Map<String, Object>> toLawSections(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return new ArrayList<>();
        }

        List<Map<String, Object>> sections = new ArrayList<>();
        for (Object item : list) {
            sections.add(normalizeLawSection(item));
        }
        return sections;
    }

    private List<Map<String, Object>> toCustomLawSections(Object raw) {
        List<Map<String, Object>> sections = toLawSections(raw);
        return sections.stream()
                .filter(section -> !isSpecialLawSectionName(Objects.toString(section.get("name"), "")))
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private Map<String, Object> findLawSection(Object raw, String expectedName) {
        List<Map<String, Object>> sections = toLawSections(raw);
        for (Map<String, Object> section : sections) {
            String name = Objects.toString(section.get("name"), "");
            if (normalizeSectionName(name).equals(normalizeSectionName(expectedName))) {
                return section;
            }
        }
        return null;
    }

    private boolean isSpecialLawSectionName(String name) {
        String normalized = normalizeSectionName(name);
        return normalized.equals(normalizeSectionName(GOVERNING_LAW_SECTION_NAME))
                || normalized.equals(normalizeSectionName(JURISDICTION_SECTION_NAME));
    }

    private String normalizeSectionName(String name) {
        return Objects.toString(name, "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "");
    }

    private static Map<String, Object> toSpecialLawSection(String name, List<Map<String, String>> rows, List<String> baseKeys) {
        Map<String, Object> section = new LinkedHashMap<>();
        section.put("name", name);

        List<Map<String, String>> safeRows = rows == null ? List.of() : rows;
        List<Map<String, String>> columns = new ArrayList<>();
        for (Map<String, String> row : safeRows) {
            if (row == null) {
                continue;
            }
            for (String key : row.keySet()) {
                if (baseKeys.contains(key) || columns.stream().anyMatch(col -> key.equals(col.get("key")))) {
                    continue;
                }
                Map<String, String> column = new LinkedHashMap<>();
                column.put("key", key);
                column.put("label", humanizeColumnLabel(key));
                columns.add(column);
            }
        }
        section.put("columns", columns);
        section.put("rows", safeRows);
        return section;
    }

    private static String humanizeColumnLabel(String key) {
        String normalized = Objects.toString(key, "").trim();
        if (normalized.isEmpty()) {
            return "Column";
        }
        String[] parts = normalized.replaceAll("[_-]+", " ").trim().split("\\s+");
        StringBuilder label = new StringBuilder();
        for (int index = 0; index < parts.length; index++) {
            if (parts[index].isEmpty()) {
                continue;
            }
            String word = parts[index];
            label.append(Character.toUpperCase(word.charAt(0)));
            if (word.length() > 1) {
                label.append(word.substring(1));
            }
            if (index < parts.length - 1) {
                label.append(' ');
            }
        }
        return label.toString().trim();
    }

    private Map<String, Object> normalizeLawSection(Object raw) {
        Map<String, Object> section = new LinkedHashMap<>();
        section.put("name", "");
        section.put("columns", new ArrayList<Map<String, String>>());
        section.put("rows", new ArrayList<Map<String, String>>());

        if (raw instanceof Map<?, ?> map) {
            String name = Objects.toString(map.get("name"), "");
            if (name.isBlank()) {
                name = Objects.toString(map.get("title"), "");
            }
            if (name.isBlank()) {
                name = Objects.toString(map.get("sectionName"), "");
            }

            Object rowsSource = map.get("rows");
            if (!(rowsSource instanceof List<?>)) {
                rowsSource = map.get("governingLawRows");
            }

            List<Map<String, String>> columns = toLawSectionColumns(map.get("columns"));

            section.put("name", name);
            section.put("columns", columns);
            section.put("rows", toLawSectionRows(rowsSource, columns));
        }

        return section;
    }

    private List<Map<String, String>> toLawSectionColumns(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return new ArrayList<>();
        }

        List<Map<String, String>> columns = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> map)) {
                continue;
            }
            String label = Objects.toString(map.get("label"), "").trim();
            if (label.isEmpty()) {
                label = Objects.toString(map.get("name"), "").trim();
            }
            if (label.isEmpty()) {
                label = Objects.toString(map.get("key"), "").trim();
            }
            if (label.isEmpty()) {
                continue;
            }

            String key = normalizeLawColumnKey(map.get("key"), label);
            if (key.isEmpty() || LAW_BASE_KEYS.contains(key) || columns.stream().anyMatch(col -> key.equals(col.get("key")))) {
                continue;
            }

            Map<String, String> column = new LinkedHashMap<>();
            column.put("key", key);
            column.put("label", label);
            columns.add(column);
        }
        return columns;
    }

    private String normalizeLawColumnKey(Object rawKey, String fallbackLabel) {
        String source = Objects.toString(rawKey, "").trim();
        if (source.isEmpty()) {
            source = fallbackLabel;
        }
        return source
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
    }

    private List<Map<String, String>> toLawSectionRows(Object raw, List<Map<String, String>> columns) {
        if (!(raw instanceof List<?> list)) {
            return new ArrayList<>();
        }

        List<Map<String, String>> rows = new ArrayList<>();
        for (Object item : list) {
            rows.add(normalizeLawSectionRow(item, columns));
        }
        return rows;
    }

    private Map<String, String> normalizeLawSectionRow(Object raw, List<Map<String, String>> columns) {
        Map<String, String> row = normalizeGoverningLaw(raw);

        if (raw instanceof Map<?, ?> map) {
            map.forEach((key, value) -> {
                String normalizedKey = Objects.toString(key, "").trim();
                if (normalizedKey.isEmpty()) {
                    return;
                }
                if (row.containsKey(normalizedKey)) {
                    row.put(normalizedKey, Objects.toString(value, ""));
                    return;
                }
                row.put(normalizedKey, Objects.toString(value, ""));
            });
        }

        for (Map<String, String> column : columns) {
            String key = column.getOrDefault("key", "");
            if (!key.isEmpty()) {
                row.putIfAbsent(key, "");
            }
        }

        return row;
    }

    private Map<String, String> normalizeGoverningLaw(Object raw) {
        Map<String, String> value = new LinkedHashMap<>();
        value.put("applicable", "");
        value.put("accuracy", "");
        value.put("snippet", "");
        value.put("page", "");
        value.put("country", "");

        if (raw instanceof Map<?, ?> map) {
            value.put("applicable", Objects.toString(map.get("applicable"), ""));
            value.put("accuracy", Objects.toString(map.get("accuracy"), ""));
            value.put("snippet", Objects.toString(map.get("snippet"), ""));
            value.put("page", Objects.toString(map.get("page"), ""));
            value.put("country", Objects.toString(map.get("country"), ""));
            map.forEach((key, entryValue) -> {
                String normalizedKey = Objects.toString(key, "").trim();
                if (normalizedKey.isEmpty() || value.containsKey(normalizedKey)) {
                    return;
                }
                value.put(normalizedKey, Objects.toString(entryValue, ""));
            });
        } else {
            value.put("applicable", Objects.toString(raw, ""));
        }

        return value;
    }

    private Map<String, String> normalizeJurisdiction(Object raw) {
        Map<String, String> value = new LinkedHashMap<>();
        value.put("applicable", "");
        value.put("accuracy", "");
        value.put("snippet", "");
        value.put("page", "");
        value.put("risk", "");
        value.put("reasoning", "");

        if (raw instanceof Map<?, ?> map) {
            value.put("applicable", Objects.toString(map.get("applicable"), ""));
            value.put("accuracy", Objects.toString(map.get("accuracy"), ""));
            value.put("snippet", Objects.toString(map.get("snippet"), ""));
            value.put("page", Objects.toString(map.get("page"), ""));
            value.put("risk", Objects.toString(map.get("risk"), ""));
            value.put("reasoning", Objects.toString(map.get("reasoning"), ""));
            map.forEach((key, entryValue) -> {
                String normalizedKey = Objects.toString(key, "").trim();
                if (normalizedKey.isEmpty() || value.containsKey(normalizedKey)) {
                    return;
                }
                value.put(normalizedKey, Objects.toString(entryValue, ""));
            });
        } else {
            value.put("applicable", Objects.toString(raw, ""));
        }

        return value;
    }

    private int intValue(Object value, int fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private boolean boolValue(Object value, boolean fallback) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof String text) {
            return "true".equalsIgnoreCase(text);
        }
        return fallback;
    }

    private String stringValue(Object value, String fallback) {
        if (value == null) {
            return fallback;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? fallback : text;
    }

    private ContractRecord getOrThrow(String id) {
        ContractRecord record = store.get(id);
        if (record == null) {
            throw new IllegalArgumentException("Contract record not found for id: " + id);
        }
        return record;
    }

    private void seedData() {
        List<Map<String, Object>> uploadedRows = loadUploadedRows();
        if (uploadedRows.isEmpty()) {
            store.clear();
            return;
        }
        reloadStoreFromRows(uploadedRows, "CREATE", "Loaded from uploaded seed JSON");
    }

    private List<Map<String, Object>> loadUploadedRows() {
        try {
            Path path = Paths.get("src", "main", "resources", UPLOADED_SEED_FILE).toAbsolutePath();
            if (!Files.exists(path)) {
                return List.of();
            }
            return mapper.readValue(path.toFile(), new com.fasterxml.jackson.core.type.TypeReference<>() {
            });
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private record ColumnMeta(int columnIndex, String groupLabel, String childLabel) {
    }

    private static final class CustomSectionAccumulator {
        private final Map<String, String> rowValues = new LinkedHashMap<>();
        private final Map<String, String> labelsByKey = new LinkedHashMap<>();

        void addColumnValue(String childLabel, String value) {
            String key = childLabel
                    .toLowerCase(Locale.ROOT)
                    .replaceAll("[^a-z0-9]+", "_")
                    .replaceAll("^_+|_+$", "");
            if (key.isEmpty()) {
                return;
            }
            labelsByKey.putIfAbsent(key, childLabel);
            rowValues.put(key, value);
        }

        Map<String, Object> toLawSection(String sectionName) {
            Map<String, Object> section = new LinkedHashMap<>();
            section.put("name", sectionName);

            List<Map<String, String>> columns = new ArrayList<>();
            labelsByKey.forEach((key, label) -> {
                if (LAW_BASE_KEYS.contains(key)) {
                    return;
                }
                Map<String, String> column = new LinkedHashMap<>();
                column.put("key", key);
                column.put("label", label);
                columns.add(column);
            });
            section.put("columns", columns);

            Map<String, String> row = new LinkedHashMap<>();
            LAW_BASE_KEYS.forEach((baseKey) -> row.put(baseKey, rowValues.getOrDefault(baseKey, "")));
            labelsByKey.forEach((key, ignored) -> {
                if (!LAW_BASE_KEYS.contains(key)) {
                    row.put(key, rowValues.getOrDefault(key, ""));
                }
            });
            section.put("rows", List.of(row));
            return section;
        }

        boolean hasAnyValue() {
            return rowValues.values().stream().anyMatch(value -> value != null && !value.isBlank());
        }
    }

    private static final class ParsedUploadRow {
        private final Map<String, String> directFields = new HashMap<>();
        private final Map<String, String> governingLaw = new LinkedHashMap<>();
        private final Map<String, String> jurisdiction = new LinkedHashMap<>();
        private final Map<String, CustomSectionAccumulator> customSections = new LinkedHashMap<>();

        boolean isEmpty() {
            boolean baseEmpty = directFields.values().stream().allMatch(value -> value == null || value.isBlank());
            boolean governingEmpty = governingLaw.values().stream().allMatch(value -> value == null || value.isBlank());
            boolean jurisdictionEmpty = jurisdiction.values().stream().allMatch(value -> value == null || value.isBlank());
            boolean customEmpty = customSections.values().stream().noneMatch(CustomSectionAccumulator::hasAnyValue);
            return baseEmpty && governingEmpty && jurisdictionEmpty && customEmpty;
        }

        Map<String, Object> toRecordMap() {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("documentName", directFields.getOrDefault("documentName", ""));
            row.put("documentLink", directFields.getOrDefault("documentLink", ""));
            row.put("clientIdentifier", directFields.getOrDefault("clientIdentifier", ""));
            row.put("cdokType", directFields.getOrDefault("cdokType", ""));
            row.put("editedBy", directFields.getOrDefault("editedBy", "upload-user"));
            row.put("status", directFields.getOrDefault("status", "Draft"));

            Map<String, String> gl = new LinkedHashMap<>();
            gl.put("applicable", governingLaw.getOrDefault("applicable", ""));
            gl.put("accuracy", governingLaw.getOrDefault("accuracy", ""));
            gl.put("snippet", governingLaw.getOrDefault("snippet", ""));
            gl.put("page", governingLaw.getOrDefault("page", ""));
            gl.put("country", governingLaw.getOrDefault("country", ""));

            Map<String, String> jur = new LinkedHashMap<>();
            jur.put("applicable", jurisdiction.getOrDefault("applicable", ""));
            jur.put("accuracy", jurisdiction.getOrDefault("accuracy", ""));
            jur.put("snippet", jurisdiction.getOrDefault("snippet", ""));
            jur.put("page", jurisdiction.getOrDefault("page", ""));
            jur.put("risk", jurisdiction.getOrDefault("risk", ""));
            jur.put("reasoning", jurisdiction.getOrDefault("reasoning", ""));

            List<Map<String, Object>> lawSections = new ArrayList<>();
            lawSections.add(ContractManagementService.toSpecialLawSection(
                GOVERNING_LAW_SECTION_NAME,
                List.of(gl),
                LAW_BASE_KEYS
            ));
            lawSections.add(ContractManagementService.toSpecialLawSection(
                JURISDICTION_SECTION_NAME,
                List.of(jur),
                JURISDICTION_BASE_KEYS
            ));

            List<Map<String, Object>> customLawSections = customSections.entrySet().stream()
                    .map(entry -> entry.getValue().toLawSection(entry.getKey()))
                    .collect(Collectors.toCollection(ArrayList::new));
            lawSections.addAll(customLawSections);
            row.put("lawSections", lawSections);

            return row;
        }
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        String escaped = value.replace("\"", "\"\"");
        if (escaped.contains(",") || escaped.contains("\n")) {
            return "\"" + escaped + "\"";
        }
        return escaped;
    }

    private record DownloadSection(
            String name,
            List<String> columnKeys,
            List<String> columnLabels,
            List<Map<String, String>> rows
    ) {
    }

    public record DownloadPayload(String fileName, String contentType, byte[] bytes) {
    }

    static class ContractRecord {
        private String id;
        private String documentName;
        private String documentLink;
        private String clientIdentifier;
        private String cdokType;
        private String status;
        private String editedBy;
        private List<Map<String, String>> governingLawRows;
        private List<Map<String, String>> jurisdictionRows;
        private List<Map<String, Object>> lawSections;
        private List<Map<String, Object>> auditTrail;

        private Map<String, Object> toMap() {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", id);
            result.put("documentName", documentName);
            result.put("documentLink", documentLink);
            result.put("clientIdentifier", clientIdentifier);
            result.put("cdokType", cdokType);
            result.put("status", status);
            result.put("editedBy", editedBy);

            List<Map<String, Object>> allLawSections = new ArrayList<>();
            allLawSections.add(toSpecialLawSection(GOVERNING_LAW_SECTION_NAME, governingLawRows, LAW_BASE_KEYS));
            allLawSections.add(toSpecialLawSection(JURISDICTION_SECTION_NAME, jurisdictionRows, JURISDICTION_BASE_KEYS));
            if (lawSections != null) {
                allLawSections.addAll(lawSections);
            }
            result.put("lawSections", allLawSections);

            result.put("auditTrail", auditTrail);
            return result;
        }
    }
}
