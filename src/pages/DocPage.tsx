import './DocPage.css';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocs } from '../contexts/DocsContext';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function DocPage() {
  const { docId } = useParams<{ docId: string }>();
  const { getDocById, loading } = useDocs();
  const navigate = useNavigate();

  const doc = docId ? getDocById(docId) : undefined;

  if (loading) {
    return (
      <div className="doc-page-loading">
        <div className="doc-skeleton">
          <div className="skeleton-title" />
          <div className="skeleton-line" style={{ width: '80%' }} />
          <div className="skeleton-line" style={{ width: '65%' }} />
          <div className="skeleton-line" style={{ width: '90%' }} />
          <div className="skeleton-line" style={{ width: '70%' }} />
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="doc-page-empty">
        <div className="doc-empty-content">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <h2>Document not found</h2>
          <p>This document may have been moved or deleted.</p>
          <button className="doc-back-btn" onClick={() => navigate('/')}>
            Go home
          </button>
        </div>
      </div>
    );
  }

  const repoName = doc.repo?.split('/')[1] || doc.repo;
  const pathParts = doc.path?.split('/') || [];

  return (
    <div className="doc-page">
      {/* Breadcrumb */}
      <div className="doc-breadcrumb">
        <button className="doc-breadcrumb-item" onClick={() => navigate('/')}>
          {repoName}
        </button>
        {pathParts.slice(0, -1).map((part, i) => (
          <span key={i} className="doc-breadcrumb-sep" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="doc-breadcrumb-item doc-breadcrumb-dir">{part}</span>
          </span>
        ))}
        <span className="doc-breadcrumb-sep" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
        <span className="doc-breadcrumb-current">{doc.title || pathParts[pathParts.length - 1]}</span>
      </div>

      {/* Content */}
      <div className="doc-content">
        <MarkdownRenderer content={doc.content || ''} />
      </div>
    </div>
  );
}
