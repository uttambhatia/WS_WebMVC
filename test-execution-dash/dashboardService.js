import axios from "axios";

const DASHBOARD_API_BASE_URL = "http://localhost:8095";

const dashboardHttp = axios.create({
  baseURL: DASHBOARD_API_BASE_URL,
  timeout: 30000,
});

export function fetchDashboardSummary({ applicationId, startDate, endDate } = {}) {
  return dashboardHttp
    .get("/summary", {
      params: {
        applicationId,
        startDate,
        endDate,
      },
    })
    .then((res) => res.data);
}

export function fetchDashboardTrends({
  period = "day",
  days,
  applicationId,
  startDate,
  endDate,
} = {}) {
  return dashboardHttp
    .get("/trends/pass-fail", {
      params: {
        period,
        days,
        applicationId,
        startDate,
        endDate,
      },
    })
    .then((res) => res.data);
}
