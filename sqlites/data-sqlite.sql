INSERT OR IGNORE INTO mst_frequency (frequency_id, frequency_code, frequency_name) VALUES
(1, 'DAILY', 'Daily'),
(2, 'WEEKLY', 'Weekly'),
(3, 'WEEKDAYS', 'Weekdays'),
(4, 'MONTHLY', 'Monthly'),
(5, 'BI_MONTHLY', 'Bi-Monthly'),
(6, 'FORTNIGHTLY', 'Fortnightly');

INSERT OR IGNORE INTO mst_timezone (timezone_id, timezone_code, timezone_name) VALUES
(1, 'UTC', 'Coordinated Universal Time'),
(2, 'Asia/Kolkata', 'India Standard Time'),
(3, 'America/New_York', 'Eastern Time'),
(4, 'Europe/London', 'Greenwich Mean Time');