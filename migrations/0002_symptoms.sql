CREATE TABLE symptoms (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, kind TEXT NOT NULL);
CREATE INDEX idx_symptoms_user_date ON symptoms (user_id, date);
