<div className="te__card-head">
            <h3>Select Test Scripts</h3>
            <span><span className="te__card-head-badge">{selectedSet.size}</span> Test selected</span>
          </div>


.te__card-head span {
  color: var(--ubs-c-text-muted);
  font-size: var(--ubs-font-sz-sm);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.1rem;
}

.te__card-head-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.7rem;
  height: 1rem;
  background-color: var(--ubs-c-red);
  color: white !important;
  font-size: var(--ubs-font-sz-sm);
  font-weight: 600;
  border-radius: 50%;
}
