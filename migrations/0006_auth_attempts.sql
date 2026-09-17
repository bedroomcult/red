-- Persistent rate limiting for /api/auth.
--
-- The in-memory Map in _lib.ts was per-isolate, so the 10-attempt limit only
-- held within one isolate: an attacker hitting a different isolate started with
-- a fresh counter. Login and signup both need a shared counter.
CREATE TABLE auth_attempts (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX idx_auth_attempts_ip_at ON auth_attempts (ip, at);
