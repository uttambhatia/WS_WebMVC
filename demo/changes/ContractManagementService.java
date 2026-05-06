package com.ubs.testmanagement.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
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

    private static final String SEED_RESOURCE = "contract_management_seed.json";

    private final Map<String, ContractRecord> store = new ConcurrentHashMap<>();

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

    private String buildReportText(ContractRecord record) {
        StringBuilder body = new StringBuilder();
        body.append("Document Name,Document Link,Client Identifier,CDOK Type,Edited By,Governing Law,,,,,Jurisdiction,,,,,\n");
        body.append(",,,,,Applicable,Accuracy,Snippet,Page,Country,Applicable,Accuracy,Snippet,Page,Risk,Reasoning\n");

        List<Map<String, String>> glRows = record.governingLawRows != null ? record.governingLawRows : List.of();
        List<Map<String, String>> jurisdictionRows = record.jurisdictionRows != null ? record.jurisdictionRows : List.of();
        int totalRows = Math.max(1, Math.max(glRows.size(), jurisdictionRows.size()));

        for (int index = 0; index < totalRows; index++) {
            if (index == 0) {
                body.append(escapeCsv(record.documentName)).append(",")
                        .append(escapeCsv(record.documentLink)).append(",")
                        .append(escapeCsv(record.clientIdentifier)).append(",")
                        .append(escapeCsv(record.cdokType)).append(",")
                        .append(escapeCsv(record.editedBy)).append(",");
            } else {
                body.append(",,,,,");
            }

            Map<String, String> glRow = index < glRows.size() ? glRows.get(index) : Map.of();
            body.append(escapeCsv(glRow.getOrDefault("applicable", ""))).append(",")
                    .append(escapeCsv(glRow.getOrDefault("accuracy", ""))).append(",")
                    .append(escapeCsv(glRow.getOrDefault("snippet", ""))).append(",")
                    .append(escapeCsv(glRow.getOrDefault("page", ""))).append(",")
                    .append(escapeCsv(glRow.getOrDefault("country", ""))).append(",");

            Map<String, String> jurisdictionRow = index < jurisdictionRows.size() ? jurisdictionRows.get(index) : Map.of();
            body.append(escapeCsv(jurisdictionRow.getOrDefault("applicable", ""))).append(",")
                    .append(escapeCsv(jurisdictionRow.getOrDefault("accuracy", ""))).append(",")
                    .append(escapeCsv(jurisdictionRow.getOrDefault("snippet", ""))).append(",")
                    .append(escapeCsv(jurisdictionRow.getOrDefault("page", ""))).append(",")
                    .append(escapeCsv(jurisdictionRow.getOrDefault("risk", ""))).append(",")
                    .append(escapeCsv(jurisdictionRow.getOrDefault("reasoning", ""))).append("\n");
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

        lines.add("Governing Law:");
        List<Map<String, String>> glRows = record.governingLawRows != null ? record.governingLawRows : List.of();
        if (glRows.isEmpty()) {
            lines.add("  - No governing law rows");
        } else {
            for (int index = 0; index < glRows.size(); index++) {
                Map<String, String> gl = glRows.get(index);
                lines.add("  [" + (index + 1) + "] Applicable: " + valueOrDash(gl.get("applicable"))
                        + " | Accuracy: " + valueOrDash(gl.get("accuracy"))
                        + " | Snippet: " + valueOrDash(gl.get("snippet"))
                        + " | Page: " + valueOrDash(gl.get("page"))
                        + " | Country: " + valueOrDash(gl.get("country")));
            }
        }

        lines.add("");
        lines.add("Jurisdiction:");
        List<Map<String, String>> jurisdictionRows = record.jurisdictionRows != null ? record.jurisdictionRows : List.of();
        if (jurisdictionRows.isEmpty()) {
            lines.add("  - No jurisdiction rows");
        } else {
            for (int index = 0; index < jurisdictionRows.size(); index++) {
                Map<String, String> jurisdiction = jurisdictionRows.get(index);
                lines.add("  [" + (index + 1) + "] Applicable: " + valueOrDash(jurisdiction.get("applicable"))
                        + " | Accuracy: " + valueOrDash(jurisdiction.get("accuracy"))
                        + " | Snippet: " + valueOrDash(jurisdiction.get("snippet"))
                        + " | Page: " + valueOrDash(jurisdiction.get("page"))
                        + " | Risk: " + valueOrDash(jurisdiction.get("risk"))
                        + " | Reasoning: " + valueOrDash(jurisdiction.get("reasoning")));
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

            Row headerRow = sheet.createRow(0);
            createCell(headerRow, 0, "Document Name", columnHeaderStyle);
            createCell(headerRow, 1, "Document Link", columnHeaderStyle);
            createCell(headerRow, 2, "Client Identifier", columnHeaderStyle);
            createCell(headerRow, 3, "CDOK Type", columnHeaderStyle);
            createCell(headerRow, 4, "Edited By", columnHeaderStyle);
            createCell(headerRow, 5, "Governing Law", glHeaderStyle);
            createCell(headerRow, 10, "Jurisdiction", jurHeaderStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 1, 0, 0));
            sheet.addMergedRegion(new CellRangeAddress(0, 1, 1, 1));
            sheet.addMergedRegion(new CellRangeAddress(0, 1, 2, 2));
            sheet.addMergedRegion(new CellRangeAddress(0, 1, 3, 3));
            sheet.addMergedRegion(new CellRangeAddress(0, 1, 4, 4));
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 5, 9));
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 10, 15));

            Row subHeaderRow = sheet.createRow(1);
            createCell(subHeaderRow, 5, "Applicable", glSubHeaderStyle);
            createCell(subHeaderRow, 6, "Accuracy", glSubHeaderStyle);
            createCell(subHeaderRow, 7, "Snippet", glSubHeaderStyle);
            createCell(subHeaderRow, 8, "Page", glSubHeaderStyle);
            createCell(subHeaderRow, 9, "Country", glSubHeaderStyle);
            createCell(subHeaderRow, 10, "Applicable", jurSubHeaderStyle);
            createCell(subHeaderRow, 11, "Accuracy", jurSubHeaderStyle);
            createCell(subHeaderRow, 12, "Snippet", jurSubHeaderStyle);
            createCell(subHeaderRow, 13, "Page", jurSubHeaderStyle);
            createCell(subHeaderRow, 14, "Risk", jurSubHeaderStyle);
            createCell(subHeaderRow, 15, "Reasoning", jurSubHeaderStyle);

            Row detailsRow = sheet.createRow(2);
            createCell(detailsRow, 0, record.documentName, null);
            createCell(detailsRow, 1, record.documentLink, null);
            createCell(detailsRow, 2, record.clientIdentifier, null);
            createCell(detailsRow, 3, record.cdokType, null);
            createCell(detailsRow, 4, record.editedBy, null);

            List<Map<String, String>> glRows = record.governingLawRows != null ? record.governingLawRows : List.of();
            List<Map<String, String>> jurisdictionRows = record.jurisdictionRows != null ? record.jurisdictionRows : List.of();
            int totalRows = Math.max(1, Math.max(glRows.size(), jurisdictionRows.size()));
            for (int index = 0; index < totalRows; index++) {
                Row dataRow = sheet.getRow(index + 2);
                if (dataRow == null) {
                    dataRow = sheet.createRow(index + 2);
                }

                if (index < glRows.size()) {
                    Map<String, String> glRow = glRows.get(index);
                    createCell(dataRow, 5, glRow.getOrDefault("applicable", ""), null);
                    createCell(dataRow, 6, glRow.getOrDefault("accuracy", ""), null);
                    createCell(dataRow, 7, glRow.getOrDefault("snippet", ""), null);
                    createCell(dataRow, 8, glRow.getOrDefault("page", ""), null);
                    createCell(dataRow, 9, glRow.getOrDefault("country", ""), null);
                }

                if (index < jurisdictionRows.size()) {
                    Map<String, String> jurisdictionRow = jurisdictionRows.get(index);
                    createCell(dataRow, 10, jurisdictionRow.getOrDefault("applicable", ""), null);
                    createCell(dataRow, 11, jurisdictionRow.getOrDefault("accuracy", ""), null);
                    createCell(dataRow, 12, jurisdictionRow.getOrDefault("snippet", ""), null);
                    createCell(dataRow, 13, jurisdictionRow.getOrDefault("page", ""), null);
                    createCell(dataRow, 14, jurisdictionRow.getOrDefault("risk", ""), null);
                    createCell(dataRow, 15, jurisdictionRow.getOrDefault("reasoning", ""), null);
                }
            }

            // Use fixed widths to avoid font-metric dependency from autoSizeColumn,
            // which can fail in headless environments with limited fonts.
            applyExcelColumnWidths(sheet);

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

    private void applyExcelColumnWidths(Sheet sheet) {
        // POI width unit: 1/256th of a character.
        sheet.setColumnWidth(0, 22 * 256); // Document Name
        sheet.setColumnWidth(1, 30 * 256); // Document Link
        sheet.setColumnWidth(2, 20 * 256); // Client Identifier
        sheet.setColumnWidth(3, 16 * 256); // CDOK Type
        sheet.setColumnWidth(4, 16 * 256); // Edited By

        sheet.setColumnWidth(5, 14 * 256); // GL Applicable
        sheet.setColumnWidth(6, 12 * 256); // GL Accuracy
        sheet.setColumnWidth(7, 36 * 256); // GL Snippet
        sheet.setColumnWidth(8, 8 * 256);  // GL Page
        sheet.setColumnWidth(9, 14 * 256); // GL Country

        sheet.setColumnWidth(10, 14 * 256); // Jur Applicable
        sheet.setColumnWidth(11, 12 * 256); // Jur Accuracy
        sheet.setColumnWidth(12, 28 * 256); // Jur Snippet
        sheet.setColumnWidth(13, 8 * 256);  // Jur Page
        sheet.setColumnWidth(14, 10 * 256); // Jur Risk
        sheet.setColumnWidth(15, 36 * 256); // Jur Reasoning
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
        List<Map<String, Object>> convertedRows = loadConvertedRows();

        int index = 1;
        for (Map<String, Object> row : convertedRows) {
            String id = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
            ContractRecord record = new ContractRecord();
            record.id = id;
            record.documentName = stringValue(row.get("documentName"), "Contract-" + index + ".docx");
            record.documentLink = stringValue(row.get("documentLink"), "https://ubs.local/documents/contract-" + index);
            record.clientIdentifier = stringValue(row.get("clientIdentifier"), "CL-20" + index);
            record.cdokType = stringValue(row.get("cdokType"), (index % 2 == 0) ? "MSA" : "NDA");
            record.status = "Draft";
            record.editedBy = stringValue(row.get("editedBy"), "analyst" + ((index % 4) + 1));
            record.governingLawRows = toGoverningLawRows(row.get("governingLawRows"));
            record.jurisdictionRows = toJurisdictionRows(row.get("jurisdictionRows"));

            if (record.governingLawRows.isEmpty() && record.jurisdictionRows.isEmpty()) {
                record.governingLawRows = toLegacyGoverningLawRows(row.get("governingLawJurisdictionRows"));
                record.jurisdictionRows = toLegacyJurisdictionRows(row.get("governingLawJurisdictionRows"));
            }

            if (record.governingLawRows.isEmpty()) {
                Map<String, String> governingLaw = new LinkedHashMap<>();
                governingLaw.put("applicable", "Yes");
                governingLaw.put("accuracy", "High");
                governingLaw.put("snippet", "Swiss Law " + index);
                governingLaw.put("page", "1");
                governingLaw.put("country", "Switzerland");
                record.governingLawRows.add(governingLaw);
            }

            if (record.jurisdictionRows.isEmpty()) {
                Map<String, String> jurisdiction = new LinkedHashMap<>();
                jurisdiction.put("applicable", "Yes");
                jurisdiction.put("accuracy", "High");
                jurisdiction.put("snippet", "Zurich Court " + index);
                jurisdiction.put("page", "1");
                jurisdiction.put("risk", "Low");
                jurisdiction.put("reasoning", "Template baseline");
                record.jurisdictionRows.add(jurisdiction);
            }

            record.auditTrail = new ArrayList<>();
            addAudit(record, true, "CREATE", "system", "Seeded from converted data.xlsx JSON");
            store.put(id, record);
            index++;
        }

        for (int i = index; i <= 15; i++) {
            String id = UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
            ContractRecord record = new ContractRecord();
            record.id = id;
            record.documentName = "Contract-" + i + ".docx";
            record.documentLink = "https://ubs.local/documents/contract-" + i;
            record.clientIdentifier = "CL-10" + i;
            record.cdokType = (i % 2 == 0) ? "MSA" : "NDA";
            record.status = "Draft";
            record.editedBy = "analyst" + ((i % 4) + 1);
            record.governingLawRows = new ArrayList<>();
            record.jurisdictionRows = new ArrayList<>();

            Map<String, String> governingLaw = new LinkedHashMap<>();
            governingLaw.put("applicable", "Yes");
            governingLaw.put("accuracy", "High");
            governingLaw.put("snippet", "Swiss Law " + i);
            governingLaw.put("page", "1");
            governingLaw.put("country", "Switzerland");

            Map<String, String> jurisdiction = new LinkedHashMap<>();
            jurisdiction.put("applicable", "Yes");
            jurisdiction.put("accuracy", "High");
            jurisdiction.put("snippet", "Zurich Court " + i);
            jurisdiction.put("page", "1");
            jurisdiction.put("risk", "Low");
            jurisdiction.put("reasoning", "Seeded sample record");

            record.governingLawRows.add(governingLaw);
            record.jurisdictionRows.add(jurisdiction);

            record.auditTrail = new ArrayList<>();
            addAudit(record, true, "CREATE", "system", "Seeded in-memory sample record");
            store.put(id, record);
        }
    }

    private List<Map<String, Object>> loadConvertedRows() {
        try {
            ClassPathResource resource = new ClassPathResource(SEED_RESOURCE);
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(resource.getInputStream(), new TypeReference<>() {
            });
        } catch (Exception ignored) {
            return List.of();
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
            result.put("governingLawRows", governingLawRows);
            result.put("jurisdictionRows", jurisdictionRows);

            Map<String, Object> legacyContainer = new LinkedHashMap<>();
            legacyContainer.put("governingLawRows", governingLawRows);
            legacyContainer.put("jurisdictionRows", jurisdictionRows);
            result.put("governingLawJurisdictionRows", legacyContainer);

            result.put("auditTrail", auditTrail);
            return result;
        }
    }
}
