import './DeleteDraftModal.css';
import { useState, useEffect } from 'react';

interface DeleteDraftModalProps {
  isOpen: boolean;
  draftName: string;
  draftPath: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteDraftModal({
  isOpen,
  draftName,
  draftPath,
  onClose,
  onConfirm,
}: DeleteDraftModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Reset state khi mở lại
  useEffect(() => {
    if (isOpen) {
      setDeleting(false);
      setError('');
    }
  }, [isOpen]);

  // Đóng bằng Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, deleting, onClose]);

  if (!isOpen) return null;

  async function handleConfirm() {
    setDeleting(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch {
      setError('Xóa thất bại, thử lại.');
      setDeleting(false);
    }
  }

  return (
    <div
      className="delete-draft-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !deleting) onClose(); }}
    >
      <div
        className="delete-draft-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-draft-title"
      >
        {/* Icon */}
        <div className="delete-draft-icon-zone">
          <div className="delete-draft-icon-circle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
          </div>
        </div>

        {/* Body */}
        <div className="delete-draft-body">
          <h2 id="delete-draft-title" className="delete-draft-title">Xóa nháp này?</h2>
          <p className="delete-draft-desc">File này chưa được upload lên GitHub.</p>
          <span className="delete-draft-filename" title={draftPath}>
            <span className="delete-draft-filename-dot" />
            {draftName}
          </span>
        </div>

        {/* Warning */}
        <div className="delete-draft-warning">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Nháp sẽ bị xóa vĩnh viễn và không thể khôi phục.
        </div>

        {/* Error */}
        {error && (
          <div className="delete-draft-warning" role="alert" style={{ margin: '0 var(--space-md) var(--space-sm)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="delete-draft-footer">
          <button
            className="delete-draft-cancel-btn"
            onClick={onClose}
            disabled={deleting}
          >
            Hủy
          </button>
          <button
            id="delete-draft-confirm-btn"
            className="delete-draft-confirm-btn"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <span className="delete-draft-spinner" />
                Đang xóa…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
                Xóa nháp
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
