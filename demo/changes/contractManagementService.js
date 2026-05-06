import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8095/app/EO7/api";

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

export const searchContracts = (payload) =>
  http.post("/contract-management/search", payload).then((res) => res.data);

export const updateContract = (id, payload, options = {}) =>
  http
    .put(`/contract-management/${encodeURIComponent(id)}`, payload, {
      params: {
        statusTransitionEnabled: options.statusTransitionEnabled ?? true,
        auditingEnabled: options.auditingEnabled ?? true,
      },
    })
    .then((res) => res.data);

export const submitContractForReview = (id, options = {}) =>
  http
    .post(`/contract-management/${encodeURIComponent(id)}/submit`, null, {
      params: {
        confirm: options.confirm ?? false,
        statusTransitionEnabled: options.statusTransitionEnabled ?? true,
        auditingEnabled: options.auditingEnabled ?? true,
        actor: options.actor ?? "ui-user",
      },
    })
    .then((res) => res.data);

export const approveContract = (id, options = {}) =>
  http
    .post(`/contract-management/${encodeURIComponent(id)}/approve`, null, {
      params: {
        statusTransitionEnabled: options.statusTransitionEnabled ?? true,
        auditingEnabled: options.auditingEnabled ?? true,
        actor: options.actor ?? "reviewer",
        comment: options.comment ?? "",
      },
    })
    .then((res) => res.data);

export const rejectContract = (id, options = {}) =>
  http
    .post(`/contract-management/${encodeURIComponent(id)}/reject`, null, {
      params: {
        statusTransitionEnabled: options.statusTransitionEnabled ?? true,
        auditingEnabled: options.auditingEnabled ?? true,
        actor: options.actor ?? "reviewer",
        comment: options.comment ?? "",
      },
    })
    .then((res) => res.data);

export const fetchContractAudit = (id) =>
  http.get(`/contract-management/${encodeURIComponent(id)}/audit`).then((res) => res.data);

export const downloadContract = async (id, format) => {
  const res = await http.get(`/contract-management/${encodeURIComponent(id)}/download`, {
    params: { format },
    responseType: "blob",
  });

  const contentType = res.headers["content-type"] || (format === "pdf" ? "application/pdf" : "application/octet-stream");
  const blob = new Blob([res.data], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const disposition = res.headers["content-disposition"];
  const fallbackName = `contract-${id}.${format === "excel" ? "xlsx" : format}`;
  const match = disposition ? disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i) : null;
  const filename = match ? decodeURIComponent(match[1] || match[2] || fallbackName) : fallbackName;

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
