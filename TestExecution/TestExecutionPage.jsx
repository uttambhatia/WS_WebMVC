{executionMode === "run" && (
                <div className="te__card-head-status" role="status" aria-live="polite">
                  <span className="te__card-head-status-label">Status</span>
                  <span className={statusClass(execution?.status || "idle")}>
                    {execution?.status ? formatStatus(execution.status) : "Idle"}
                  </span>
                </div>
              )}
