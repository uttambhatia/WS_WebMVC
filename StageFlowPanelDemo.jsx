
.te__status--completed {
  background: var(--ubs-c-red);
  color: #ffffff;
  border: 1px solid var(--ubs-c-red);
}

.te__status--running {
  background: var(--ubs-c-red);
  color: #ffffff;
  border: 1px solid var(--ubs-c-red);
}

.te__status--pending {
  background: var(--ubs-c-red);
  color: #ffffff;
  border: 1px solid var(--ubs-c-red);
}

.te__card-head-meta {
  color: var(--ubs-c-text-muted);
  font-size: var(--ubs-font-sz-sm);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}


.te__card-head-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.te__card-head-status-label {
  color: var(--ubs-c-text-muted);
  font-size: var(--ubs-font-sz-xs);
  font-weight: 700;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}

.te__card-head-status .te__status {
  min-height: 26px;
  min-width: 92px;
  font-size: var(--ubs-font-sz-xs);
}





<div className="te__card-head">
            <h3>Select Test Scripts</h3>
            <span className="te__card-head-meta"><span className="te__card-head-badge">{selectedSet.size}</span> Test selected</span>
          </div>




<div className="te__card-head">
            <h3>Execute Tests</h3>
            <div className="te__card-head-status" role="status" aria-live="polite">
              <span className="te__card-head-status-label">Status</span>
              <span className={statusClass(execution?.status || "idle")}>
                {execution?.status ? formatStatus(execution.status) : "Idle"}
              </span>
            </div>
          </div>
