import { useState } from 'react';
import { apiFetch, readJson } from './api';
import { t } from './i18n';

export default function LoginScreen({ onAuth }: { onAuth: (mode: 'login' | 'signup', email: string, password: string) => Promise<string | null> }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';
  // Only complain about the confirmation once there is something to compare.
  const mismatch = isSignup && confirm.length > 0 && confirm !== password;
  const tooShort = password.length > 0 && password.length < 8;
  const canSubmit = email.length > 0 && password.length >= 8 && (!isSignup || confirm === password);

  function switchMode() {
    setMode(isSignup ? 'login' : 'signup');
    setErr(null);
    setConfirm('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (isSignup && password !== confirm) {
      setErr(t.errPwMismatch);
      return;
    }
    setBusy(true);
    const message = await onAuth(mode, email, password);
    if (message) setErr(message);
    setBusy(false);
  }

  return (
    <div className="app auth">
      <div className="auth-hero">
        <div className="auth-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="40" height="40" fill="none">
            <path
              d="M24 6c5.5 7 12 14.4 12 21a12 12 0 0 1-24 0c0-6.6 6.5-14 12-21Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <h1>{t.appName}</h1>
        <p className="sub">{isSignup ? t.signupSubtitle : t.loginSubtitle}</p>
      </div>

      <div className="auth-card">
        <div className="seg" role="tablist" aria-label={t.authMode}>
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            className={`seg-btn ${!isSignup ? 'on' : ''}`}
            onClick={() => !isSignup || switchMode()}
          >
            {t.login}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            className={`seg-btn ${isSignup ? 'on' : ''}`}
            onClick={() => isSignup || switchMode()}
          >
            {t.signup}
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="auth-email">{t.email}</label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="auth-pw">{t.password}</label>
            <div className="pw-wrap">
              <input
                id="auth-pw"
                type={showPw ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder={t.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={tooShort || undefined}
                aria-describedby={tooShort ? 'auth-pw-hint' : undefined}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? t.hidePassword : t.showPassword}
                aria-pressed={showPw}
              >
                {showPw ? t.hide : t.show}
              </button>
            </div>
            {tooShort && <div className="hint-inline" id="auth-pw-hint">{t.errMinPw}</div>}
          </div>

          {isSignup && (
            <div className="field">
              <label htmlFor="auth-pw2">{t.confirmPassword}</label>
              <input
                id="auth-pw2"
                type={showPw ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder={t.confirmPasswordPlaceholder}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={mismatch || undefined}
                aria-describedby={mismatch ? 'auth-pw2-hint' : undefined}
              />
              {mismatch && <div className="hint-inline err" id="auth-pw2-hint">{t.errPwMismatch}</div>}
              {!mismatch && confirm.length > 0 && <div className="hint-inline ok">{t.pwMatch}</div>}
            </div>
          )}

          {err && <div className="err auth-err" role="alert">{err}</div>}

          <button className="btn primary auth-submit" type="submit" disabled={busy || !canSubmit}>
            {busy ? t.loading : isSignup ? t.signup : t.login}
          </button>
        </form>

        <div className="auth-switch">
          {isSignup ? t.needAccount : t.haveAccount}{' '}
          <button type="button" className="link" onClick={switchMode}>
            {isSignup ? t.login : t.signup}
          </button>
        </div>
      </div>

      <footer className="disclaimer">{t.disclaimer}</footer>
    </div>
  );
}
