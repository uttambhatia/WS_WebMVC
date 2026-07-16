CREATE TABLE IF NOT EXISTS mst_frequency (
    frequency_id INTEGER PRIMARY KEY,
    frequency_code VARCHAR(20) NOT NULL UNIQUE,
    frequency_name VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS mst_timezone (
    timezone_id INTEGER PRIMARY KEY,
    timezone_code VARCHAR(100) NOT NULL UNIQUE,
    timezone_name VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS schedules (
    schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    frequency_id INTEGER,
    schedule_time TIME NOT NULL,
    timezone_id INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT 1,
    recurring BOOLEAN NOT NULL DEFAULT 0,
    run_at DATETIME,
    last_run_at DATETIME,
    FOREIGN KEY (frequency_id) REFERENCES mst_frequency(frequency_id),
    FOREIGN KEY (timezone_id) REFERENCES mst_timezone(timezone_id)
);

CREATE TABLE IF NOT EXISTS test_executions (
    execution_id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id VARCHAR(100),
    run_type VARCHAR(20) NOT NULL CHECK (run_type IN ('ADHOC', 'SCHEDULED')),
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    schedule_id INTEGER,
    started_at DATETIME,
    finished_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    error INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id)
);

CREATE TABLE IF NOT EXISTS execution_items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    exec_case_id VARCHAR(100),
    exec_case_name VARCHAR(255),
    exec_script TEXT,
    schedule_id INTEGER,
    execution_id INTEGER,
    script_order INTEGER,
    status VARCHAR(20),
    error TEXT,
    duration_seconds INTEGER,
    FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id),
    FOREIGN KEY (execution_id) REFERENCES test_executions(execution_id),
    UNIQUE (execution_id, script_order)
);

CREATE INDEX IF NOT EXISTS idx_execution_test_id ON test_executions(test_id);
CREATE INDEX IF NOT EXISTS idx_execution_status ON test_executions(status);
CREATE INDEX IF NOT EXISTS idx_execution_schedule ON test_executions(schedule_id);