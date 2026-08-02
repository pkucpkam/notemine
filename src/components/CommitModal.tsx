import './CommitModal.css';
import { useState, useEffect, useCallback } from 'react';
import { commitFileToGitHub, listRepoBranches } from '../lib/github-sync';
import { GITHUB_REPOS } from '../lib/config';

interface CommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  docPath: string;       // e.g. "notes/my-doc.md"
  docRepo: string;       // e.g. "owner/repo"
  docSha: string;        // current sha of the file
  content: string;       // content to commit
  onCommitSuccess: (newSha: string) => void;
}

export default function CommitModal({
  isOpen,
  onClose,
  docPath,
  docRepo,
  docSha,
  content,
  onCommitSuccess,
}: CommitModalProps) {
  const filename = docPath.split('/').pop() || docPath;
  const defaultBranch = GITHUB_REPOS[0]?.branch || 'main';

  const [message, setMessage] = useState(`docs: update ${filename}`);
  const [branch, setBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<string[]>([defaultBranch]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset state khi mở modal
  useEffect(() => {
    if (isOpen) {
      setMessage(`docs: update ${filename}`);
      setBranch(defaultBranch);
      setError('');
      setSuccess(false);
      // Lấy danh sách branches
      setLoadingBranches(true);
      listRepoBranches(docRepo)
        .then((bs) => {
          setBranches(bs.length > 0 ? bs : [defaultBranch]);
          // Giữ branch hiện tại nếu hợp lệ
          if (bs.length > 0 && !bs.includes(branch)) {
            setBranch(bs[0]);
          }
        })
        .catch(() => setBranches([defaultBranch]))
        .finally(() => setLoadingBranches(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, docRepo, filename, defaultBranch]);

  const handleCommit = useCallback(async () => {
    if (!message.trim()) return;
    setCommitting(true);
    setError('');
    try {
      const newSha = await commitFileToGitHub({
        repo: docRepo,
        path: docPath,
        content,
        sha: docSha,
        message: message.trim(),
        branch,
      });
      setSuccess(true);
      onCommitSuccess(newSha);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCommitting(false);
    }
  }, [message, branch, docRepo, docPath, content, docSha, onCommitSuccess, onClose]);

  // Đóng bằng Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !committing) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, committing, onClose]);

  if (!isOpen) return null;

  return (
    <div className="commit-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !committing) onClose(); }}>
      <div className="commit-modal" role="dialog" aria-modal="true" aria-label="Commit to GitHub">
        {/* Header */}
        <div className="commit-modal-header">
          <div className="commit-modal-title-row">
            <span className="commit-modal-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="3" x2="12" y2="9" />
                <line x1="12" y1="15" x2="12" y2="21" />
                <line x1="3" y1="12" x2="9" y2="12" />
                <line x1="15" y1="12" x2="21" y2="12" />
              </svg>
            </span>
            <h2 className="commit-modal-title">Commit to GitHub</h2>
          </div>
          <button className="commit-modal-close" onClick={onClose} disabled={committing} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* File info */}
        <div className="commit-modal-file-info">
          <span className="commit-modal-file-icon" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
          <span className="commit-modal-file-path">{docPath}</span>
          <span className="commit-modal-repo-badge">{docRepo}</span>
        </div>

        {/* Body */}
        <div className="commit-modal-body">
          {/* Commit message */}
          <div className="commit-modal-field">
            <label className="commit-modal-label" htmlFor="commit-message">
              Commit message
            </label>
            <textarea
              id="commit-message"
              className="commit-modal-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="docs: update my-file.md"
              disabled={committing || success}
            />
          </div>

          {/* Branch selector */}
          <div className="commit-modal-field">
            <label className="commit-modal-label" htmlFor="commit-branch">
              Branch
            </label>
            {loadingBranches ? (
              <div className="commit-modal-branches-loading">
                <div className="commit-modal-spinner" />
                <span>Loading branches…</span>
              </div>
            ) : (
              <div className="commit-modal-select-wrap">
                <select
                  id="commit-branch"
                  className="commit-modal-select"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  disabled={committing || success}
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <span className="commit-modal-select-chevron" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="commit-modal-error" role="alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="commit-modal-footer">
          <button
            className="commit-modal-cancel-btn"
            onClick={onClose}
            disabled={committing}
          >
            Hủy
          </button>
          <button
            id="commit-modal-submit-btn"
            className={`commit-modal-submit-btn ${success ? 'commit-modal-submit-success' : ''}`}
            onClick={handleCommit}
            disabled={committing || !message.trim() || success || loadingBranches}
          >
            {success ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Committed!
              </>
            ) : committing ? (
              <>
                <div className="commit-modal-spinner commit-modal-spinner-white" />
                Committing…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                </svg>
                Commit
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
