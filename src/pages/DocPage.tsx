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

      {/* Meta row */}
      <div className="doc-meta-row">
        <span className="doc-meta-item text-caption text-faint">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" />
          </svg>
          {doc.repo}
        </span>
        <span className="doc-meta-sep" aria-hidden="true">·</span>
        <span className="doc-meta-item text-caption text-faint">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {doc.path}
        </span>
        {doc.updatedAt && (
          <>
            <span className="doc-meta-sep" aria-hidden="true">·</span>
            <span className="doc-meta-item text-caption text-faint">
              Updated {doc.updatedAt.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </>
        )}
      </div>

      {/* Content */}
      <div className="doc-content">
        <MarkdownRenderer content={doc.content || ''} />
      </div>
    </div>
  );
}
