/**
 * testManagementService.js
 *
 * Axios-based HTTP service for all Test Management API endpoints.
 * Import individual functions and pass them as `service` props to
 * StageFlowPanel stages or form components.
 *
 * Usage example:
 *   import { createCaseId, fetchCaseIdList } from '../services/testManagementService';
 */

import axios from 'axios';

/* ------------------------------------------------------------------ */
/*  Axios instance                                                     */
/* ------------------------------------------------------------------ */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8095/app/EO7/api';

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

/* ------------------------------------------------------------------ */
/*  1. Create new test case ID                                         */
/*  POST /testmanagement-case/start?caseDefinitionKey=TST-C001        */
/*  Response: string (new case ID)                                     */
/* ------------------------------------------------------------------ */
export const createCaseId = () =>
  http
    .post('/testmanagement-case/start?caseDefinitionKey=TST-C001')
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  1.1 Fetch list of test case IDs                                   */
/*  POST /testmanagement-case/list?caseDefinitionKey=TST-C001         */
/*  Response: string[] (list of case IDs)                             */
/* ------------------------------------------------------------------ */
export const fetchCaseIdList = () =>
  http
    .post('/testmanagement-case/list?caseDefinitionKey=TST-C001')
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  2. Create and get a task ID                                        */
/*  GET /testmanagement-case/{caseId}/task?processTaskId={processTaskId} */
/*  processTaskId: BPMN process task identifier for the target stage  */
/*  Response: string (task ID)                                         */
/* ------------------------------------------------------------------ */
export const getTaskId = (caseId, processTaskId) =>
  http
    .get(`/testmanagement-case/${encodeURIComponent(caseId)}/task`, {
      params: { processTaskId },
    })
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  3. Upload requirement document + optional supporting documents     */
/*  POST /testmanagement-task/{taskId}/upload                         */
/*  Body: multipart/form-data                                          */
/*    - file: requirement document (required)                          */
/*    - supportingFile: supporting document(s) (optional, multiple)    */
/* ------------------------------------------------------------------ */
export const uploadDocument = (taskId, file, supportingFile, onUploadProgress) => {
  let resolvedSupporting = supportingFile;
  let resolvedProgress = onUploadProgress;

  // Backward compatibility: uploadDocument(taskId, file, onUploadProgress)
  if (typeof supportingFile === 'function') {
    resolvedProgress = supportingFile;
    resolvedSupporting = [];
  }

  const supportingFiles = Array.isArray(resolvedSupporting)
    ? resolvedSupporting
    : (resolvedSupporting ? [resolvedSupporting] : []);

  const formData = new FormData();
  formData.append('file', file);
  supportingFiles.forEach((supporting) => {
    formData.append('supportingFile', supporting);
  });
  return http
    .post(`/testmanagement-task/${encodeURIComponent(taskId)}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: resolvedProgress,
    })
    .then((res) => res.data);
};

/* ------------------------------------------------------------------ */
/*  3.1 GitLab issue upload                                            */
/*  POST /testmanagement-task/{taskId}/gitlabIssue                    */
/*  Query params: gitlabIssue (URL), gitlabToken                      */
/*  Response: "Success" | "Failed"                                    */
/* ------------------------------------------------------------------ */
export const uploadGitlabIssue = (taskId, gitlabIssue, gitlabToken) =>
  http
    .post(`/testmanagement-task/${encodeURIComponent(taskId)}/gitlabIssue`, null, {
      params: { gitlabIssue, gitlabToken },
    })
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  4. Post-upload — complete task                                     */
/*  POST /testmanagement-task/{taskId}/complete                       */
/*  Response: "Success" | "Failed"                                    */
/* ------------------------------------------------------------------ */
export const completeTask = (taskId) =>
  http
    .post(`/testmanagement-task/${encodeURIComponent(taskId)}/complete`)
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  5. Validation — fetch variables on task                           */
/*  GET /testmanagement-task/{taskId}/variables                       */
/*  Response: Map<String, Object>  (plain JS object)                  */
/* ------------------------------------------------------------------ */
export const fetchTaskVariables = (taskId) =>
  http
    .get(`/testmanagement-task/${encodeURIComponent(taskId)}/variables`)
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  6. Approval                                                        */
/*  GET /testmanagement-task/{taskId}/approve  OR  .../reject         */
/*  decision: 'approve' | 'reject'                                    */
/*  Response: "Success" | "Failed"                                    */
/* ------------------------------------------------------------------ */
export const approveOrReject = (taskId, decision) => {
  if (decision !== 'approve' && decision !== 'reject') {
    return Promise.reject(new Error(`Invalid decision: "${decision}". Must be "approve" or "reject".`));
  }
  return http
    .get(`/testmanagement-task/${encodeURIComponent(taskId)}/${decision}`)
    .then((res) => res.data);
};

/* ------------------------------------------------------------------ */
/*  7. Fetch test cases                                                */
/*  GET /testmanagement-task/{taskId}/testcases                       */
/*  Response: Map<String, Object>  (plain JS object)                  */
/* ------------------------------------------------------------------ */
export const fetchTestCases = (taskId) =>
  http
    .get(`/testmanagement-task/${encodeURIComponent(taskId)}/testcases`)
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  8. Export test cases (binary download)                            */
/*  GET /testmanagement-task/{taskId}/export                          */
/*  Response: file blob — triggers browser download automatically     */
/* ------------------------------------------------------------------ */
export const exportTestCases = (taskId) =>
  http
    .get(`/testmanagement-task/${encodeURIComponent(taskId)}/export`, {
      responseType: 'blob',
    })
    .then((res) => {
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers['content-disposition'];
      const filename = disposition
        ? disposition.split('filename=')[1]?.replace(/"/g, '') ?? `testcases_${taskId}.xlsx`
        : `testcases_${taskId}.xlsx`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return res.data;
    });

/* ------------------------------------------------------------------ */
/*  S1. Save one stage's form data for a case                         */
/*  PUT /testmanagement-case/{caseId}/snapshot                        */
/*  Body: { stageId, data, completedUpTo }                            */
/*  Response: "Saved"                                                 */
/* ------------------------------------------------------------------ */
export const saveStageSnapshot = (caseId, stageId, data, completedUpTo) =>
  http
    .put(`/testmanagement-case/${encodeURIComponent(caseId)}/snapshot`, {
      stageId,
      data,
      completedUpTo,
    })
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  S2. Load all saved stage data for a case                          */
/*  GET /testmanagement-case/{caseId}/snapshot                        */
/*  Response: { caseId, completedUpTo, stageData: { stageId: data } } */
/* ------------------------------------------------------------------ */
export const loadSnapshot = (caseId) =>
  http
    .get(`/testmanagement-case/${encodeURIComponent(caseId)}/snapshot`)
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  S3. List all case IDs that have saved snapshots                   */
/*  GET /testmanagement-case/snapshots                                */
/*  Response: [ { caseId, completedUpTo }, ... ]                     */
/* ------------------------------------------------------------------ */
export const listSnapshots = (params = {}) =>
  http
    .get('/testmanagement-case/snapshots', { params })
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  S4. Fetch evaluation comparison metrics for a case                */
/*  GET /testmanagement-case/{caseId}/comparison                      */
/* ------------------------------------------------------------------ */
export const fetchEvaluationComparison = (caseId) =>
  http
    .get(`/testmanagement-case/${encodeURIComponent(caseId)}/comparison`)
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  H1. File hierarchy for tree selector                              */
/*  GET {VITE_TREE_HIERARCHY_ENDPOINT}                                */
/*  Default endpoint: /testmanagement-task/scripts/hierarchy          */
/* ------------------------------------------------------------------ */
const TREE_HIERARCHY_ENDPOINT =
  import.meta.env.VITE_TREE_HIERARCHY_ENDPOINT || '/testmanagement-task/scripts/hierarchy';

export const fetchTreeHierarchy = () =>
  http
    .get(TREE_HIERARCHY_ENDPOINT)
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  X1. Squash - get test-case folder by id                           */
/*  GET /test-case-folders/{folderId}?fields=id,name                  */
/* ------------------------------------------------------------------ */
export const getSquashTestCaseFolder = (folderId, options = {}) =>
  http
    .get(`/squash/test-case-folders/${encodeURIComponent(folderId)}`, {
      params: options?.apiToken
        ? {
            apiToken: options.apiToken,
          }
        : undefined,
    })
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  X2. Squash - create test-case folder                              */
/*  POST /test-case-folders                                            */
/* ------------------------------------------------------------------ */
export const createSquashTestCaseFolder = ({ name, description, parentId }, options = {}) =>
  http
    .post('/squash/test-case-folders', {
      name,
      description,
      parentId,
      apiToken: options?.apiToken,
    })
    .then((res) => res.data);

/* ------------------------------------------------------------------ */
/*  X3. Squash - save transformed test-cases payload                  */
/*  POST /test-cases (non-latest endpoint in Squash API)              */
/* ------------------------------------------------------------------ */
export const saveTestCasesToSquash = (payload, options = {}) =>
  http
    .post('/squash/test-cases', {
      payload,
      apiToken: options?.apiToken,
    })
    .then((res) => res.data);

