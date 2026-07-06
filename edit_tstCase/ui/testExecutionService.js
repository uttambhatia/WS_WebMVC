/**
 * testExecutionService.js
 *
 * Axios-based HTTP service for Test Execution endpoints.
 */

import axios from 'axios';

const TEST_EXEC_API_BASE_URL = 'http://localhost:8095';

const testExecHttp = axios.create({
  baseURL: TEST_EXEC_API_BASE_URL,
  timeout: 30000,
});

/* ------------------------------------------------------------------ */
/*  T1. Execute tests                                                  */
/*  POST /api/v1/tests/execute                                         */
/* ------------------------------------------------------------------ */
export const executeTests = (payload) =>
  testExecHttp
    .post('/api/v1/tests/execute', payload)
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  T2. Get execution status                                           */
/*  GET /api/v1/tests/{testId}                                         */
/* ------------------------------------------------------------------ */
export const getTestExecutionStatus = (testId) =>
  testExecHttp
    .get(`/api/v1/tests/${encodeURIComponent(testId)}`)
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  T3. Fetch scripts hierarchy for test execution tree                */
/*  GET /api/v1/tests/scripts                                          */
/* ------------------------------------------------------------------ */
export const fetchTestScripts = () =>
  testExecHttp
    .get('/api/v1/tests/scripts')
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  T4. Save execution in-memory                                       */
/*  POST /api/v1/saveExecution                                         */
/* ------------------------------------------------------------------ */
export const saveExecution = (payload) =>
  testExecHttp
    .post('/api/v1/saveExecution', payload)
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  T5. Fetch executions (paginated)                                   */
/*  GET /api/v1/fetchExecutions                                        */
/* ------------------------------------------------------------------ */
export const fetchExecutions = (params = {}) =>
  testExecHttp
    .get('/api/v1/fetchExecutions', { params })
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  T5.1 Timezone autocomplete                                         */
/*  GET /app/EO7/api/timezones/search?name=...                         */
/* ------------------------------------------------------------------ */
export const searchTimezones = (name = '') =>
  testExecHttp
    .get('/app/EO7/api/timezones/search', {
      params: { name },
    })
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  T5.2 Frequency autocomplete                                        */
/*  GET /app/EO7/api/frequencies/search?name=...                       */
/* ------------------------------------------------------------------ */
export const searchFrequencies = (name = '') =>
  testExecHttp
    .get('/app/EO7/api/frequencies/search', {
      params: { name },
    })
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  T5.3 Save test schedule (dummy)                                    */
/*  POST /api/v1/tests/schedule                                        */
/* ------------------------------------------------------------------ */
export const saveTestSchedule = (payload) =>
  testExecHttp
    .post('/api/v1/tests/schedule', payload)
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  T6. Download execution report                                      */
/*  GET /api/v1/tests/{testId}/report                                  */
/* ------------------------------------------------------------------ */
export const downloadExecutionReport = async (testId, reportPath) => {
  const response = await testExecHttp.get(
    reportPath || `/api/v1/tests/${encodeURIComponent(testId)}/report`,
    { responseType: 'blob' }
  );

  const url = URL.createObjectURL(response.data);
  const disposition = response.headers['content-disposition'];
  const fallback = `test_execution_report_${testId}.zip`;
  const filename = disposition
    ? disposition.split('filename=')[1]?.replace(/"/g, '') || fallback
    : fallback;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return response.data;
};
