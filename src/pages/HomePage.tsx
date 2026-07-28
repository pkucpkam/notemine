import './HomePage.css';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocs } from '../contexts/DocsContext';

export default function HomePage() {
  const { docs, loading } = useDocs();
  const navigate = useNavigate();

  // Auto-navigate to first doc if available
  useEffect(() => {
    if (!loading && docs.length > 0) {
      navigate(`/doc/${docs[0].id}`, { replace: true });
    }
  }, [docs, loading, navigate]);

  if (loading) {
    return (
      <div className="home-loading">
        <div className="home-loading-inner">
          <div className="home-logo-anim">
            <svg width="48" height="48" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#0075de" />
              <path d="M8 8h6v20H8V8zm8 0h6l8 10-8 10h-6l8-10-8-10z" fill="white" />
            </svg>
          </div>
          <p className="text-body-sm text-muted">Loading your notes…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="home-empty">
        <svg width="64" height="64" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          <rect width="36" height="36" rx="8" fill="#0075de" opacity="0.1" />
          <path d="M8 8h6v20H8V8zm8 0h6l8 10-8 10h-6l8-10-8-10z" fill="#0075de" />
        </svg>
        <h1 className="home-empty-title">Welcome to NoteMine</h1>
        <p className="home-empty-desc">
          Your personal GitHub-backed markdown knowledge base.
          <br />
          Sync a repository to get started.
        </p>
        <div className="home-steps">
          <div className="home-step">
            <span className="home-step-num">1</span>
            <span>Add your GitHub repos in <code>src/lib/config.ts</code></span>
          </div>
          <div className="home-step">
            <span className="home-step-num">2</span>
            <span>Set up your Firebase project and add the config</span>
          </div>
          <div className="home-step">
            <span className="home-step-num">3</span>
            <span>Deploy Cloud Functions and trigger a sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}
