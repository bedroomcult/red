CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE periods (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT, flow TEXT, type TEXT NOT NULL DEFAULT 'menstruation');
CREATE TABLE pill_regimens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, pill_type TEXT NOT NULL, regimen TEXT NOT NULL, pack_start_date TEXT NOT NULL);
CREATE TABLE dose_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, taken INTEGER NOT NULL);
CREATE TABLE ec_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, ec_type TEXT NOT NULL, intake_at TEXT NOT NULL, upsi_at TEXT);
