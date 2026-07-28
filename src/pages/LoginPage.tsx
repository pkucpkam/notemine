import './LoginPage.css';
import { useState } from 'react';
import { signInWithGitHub } from '../lib/auth';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleLogin() {
    setLoading(true);
    setError('');
    try {
      await signInWithGitHub();
      navigate('/');
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'ACCESS_DENIED') {
        setError('Access denied. This app is private.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-grid" aria-hidden="true" />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <rect width="36" height="36" rx="8" fill="#0075de" />
            <path d="M10 10h4v16h-4V10zm6 0h4l6 8-6 8h-4l6-8-6-8z" fill="white" />
          </svg>
          <span className="login-logo-text">NoteMine</span>
        </div>

        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">
          Your personal markdown knowledge base, synced from GitHub.
        </p>

        <button
          id="login-github-btn"
          className="login-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <span className="login-btn-spinner" aria-hidden="true" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
          )}
          {loading ? 'Signing in…' : 'Continue with GitHub'}
        </button>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <p className="login-footer-note">
          Personal use only — requires authorized GitHub account.
        </p>
      </div>
    </div>
  );
}
