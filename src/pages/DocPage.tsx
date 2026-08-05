import './DocPage.css';
import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocs } from '../contexts/DocsContext';
import MarkdownRenderer from '../components/MarkdownRenderer';
import DocEditor from '../components/DocEditor';
import type { DocEntry } from '../lib/firestore';
import type { Timestamp } from 'firebase/firestore';

export default function DocPage() {
  const { docId } = useParams<{ docId: string }>();
  const { getDocById, getDraftById, loading } = useDocs();
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);

  const syncedDoc = docId ? getDocById(docId) : undefined;
  const draft = !syncedDoc && docId ? getDraftById(docId) : undefined;

  // Nếu là draft, tạo DocEntry tạm để render DocEditor
  const doc: DocEntry | undefined = syncedDoc ?? (draft ? {
    id: draft.id,
    repo: draft.repo,
    path: draft.path,
    title: draft.title,
    content: draft.content,
    sha: '',
    headings: [],
    frontmatter: {},
    updatedAt: draft.updatedAt as Timestamp | null,
  } : undefined);

  const isDraftDoc = !syncedDoc && !!draft;

  const handleCommitSuccess = useCallback((_newSha: string) => {
    // sha sẽ được cập nhật qua Firestore subscription sau khi sync
  }, []);

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
        <span className="doc-breadcrumb-current">
          {doc.title || pathParts[pathParts.length - 1]}
          {isDraftDoc && (
            <span className="doc-breadcrumb-draft-badge" title="Nháp, chưa upload lên GitHub">draft</span>
          )}
        </span>

        {/* Edit toggle button in breadcrumb */}
        <div className="doc-breadcrumb-actions">
          <button
            id="doc-edit-toggle-btn"
            className={`doc-edit-btn ${isEditMode ? 'doc-edit-btn-active' : ''}`}
            onClick={() => setIsEditMode(!isEditMode)}
            title={isEditMode ? 'Thoát chỉnh sửa' : 'Chỉnh sửa tài liệu'}
          >
            {isEditMode ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
                View
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </>
            )}
          </button>
        </div>
      </div>

      {/* Content / Editor */}
      {(isEditMode || isDraftDoc) ? (
        <DocEditor
          key={doc.id}
          doc={doc}
          isDraft={isDraftDoc}
          onCommitSuccess={handleCommitSuccess}
          onExitEdit={isDraftDoc ? undefined : () => setIsEditMode(false)}
        />
      ) : (
        <div className="doc-content">
          <MarkdownRenderer content={doc.content || ''} />
        </div>
      )}
    </div>
  );
}
