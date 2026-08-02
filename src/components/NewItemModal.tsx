import './NewItemModal.css';
import { useState, useEffect, useCallback } from 'react';
import { saveDraft } from '../lib/firestore';
import { GITHUB_REPOS } from '../lib/config';

export type NewItemType = 'document' | 'folder';

interface NewItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Đường dẫn folder hiện tại (context từ sidebar), để pre-fill path */
  contextFolder?: string;
  /** Loại mặc định khi mở */
  defaultType?: NewItemType;
  onSuccess?: () => void;
}

function hasInvalidChars(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 31 || '<>:"\\|?*'.includes(str[i])) return true;
  }
  return false;
}

function sanitizeName(name: string): string {
  return name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
}

export default function NewItemModal({
  isOpen,
  onClose,
  contextFolder = '',
  defaultType = 'document',
  onSuccess,
}: NewItemModalProps) {
  const repo = GITHUB_REPOS[0] ? `${GITHUB_REPOS[0].owner}/${GITHUB_REPOS[0].repo}` : '';
  const branch = GITHUB_REPOS[0]?.branch || 'main';

  const [type, setType] = useState<NewItemType>(defaultType);
  const [name, setName] = useState('');
  const [folder, setFolder] = useState(contextFolder);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType(defaultType);
      setName('');
      setFolder(contextFolder);
      setError('');
      setSuccess(false);
    }
  }, [isOpen, defaultType, contextFolder]);

  const validate = (): string | null => {
    if (!name.trim()) return 'Tên không được để trống';
    if (hasInvalidChars(name)) return 'Tên chứa ký tự không hợp lệ';
    if (!repo) return 'Chưa cấu hình GitHub repo trong .env';
    return null;
  };

  const getFullPath = (): string => {
    const base = folder.trim().replace(/^\/|\/$/g, '');
    const safeName = sanitizeName(name.trim());
    if (type === 'document') {
      const withExt = safeName.endsWith('.md') ? safeName : `${safeName}.md`;
      return base ? `${base}/${withExt}` : withExt;
    }
    return base ? `${base}/${safeName}` : safeName;
  };

  const handleCreate = useCallback(async () => {
    const err = validate();
    if (err) { setError(err); return; }

    setCreating(true);
    setError('');
    const fullPath = getFullPath();
    const title = name.trim().replace(/\.md$/, '');

    try {
      // Lưu vào Firestore drafts (KHÔNG commit GitHub)
      await saveDraft({
        repo,
        path: fullPath,
        title,
        content: type === 'document' ? `# ${title}\n\n` : '',
        type,
        branch,
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
        setSuccess(false);
      }, 1000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 120) : String(e));
    } finally {
      setCreating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, folder, type, repo, branch]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !creating) onClose();
      if (e.key === 'Enter' && isOpen && !creating && !success && e.ctrlKey) handleCreate();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, creating, success, handleCreate, onClose]);

  if (!isOpen) return null;

  const fullPathPreview = name.trim() ? getFullPath() : '';

  return (
    <div
      className="new-item-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !creating) onClose(); }}
    >
      <div className="new-item-modal" role="dialog" aria-modal="true" aria-label={`Tạo ${type === 'document' ? 'tài liệu' : 'thư mục'} mới`}>
        {/* Header */}
        <div className="new-item-header">
          <div className="new-item-title-row">
            <span className="new-item-icon" aria-hidden="true">
              {type === 'document' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
                </svg>
              )}
            </span>
            <h2 className="new-item-title">
              Tạo {type === 'document' ? 'tài liệu' : 'thư mục'} mới
            </h2>
          </div>
          <button className="new-item-close" onClick={onClose} disabled={creating} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Type Switcher */}
        <div className="new-item-type-tabs">
          <button
            className={`new-item-type-tab ${type === 'document' ? 'active' : ''}`}
            onClick={() => setType('document')}
            disabled={creating}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            Tài liệu
          </button>
          <button
            className={`new-item-type-tab ${type === 'folder' ? 'active' : ''}`}
            onClick={() => setType('folder')}
            disabled={creating}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            Thư mục
          </button>
        </div>

        {/* Body */}
        <div className="new-item-body">
          {/* Name field */}
          <div className="new-item-field">
            <label className="new-item-label" htmlFor="new-item-name">
              Tên {type === 'document' ? 'tài liệu' : 'thư mục'}
            </label>
            <input
              id="new-item-name"
              type="text"
              className="new-item-input"
              placeholder={type === 'document' ? 'my-document' : 'my-folder'}
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              disabled={creating || success}
              autoFocus
              autoComplete="off"
            />
            {type === 'document' && (
              <span className="new-item-hint">Phần mở rộng .md sẽ được thêm tự động</span>
            )}
          </div>

          {/* Folder path */}
          <div className="new-item-field">
            <label className="new-item-label" htmlFor="new-item-folder">
              Vị trí (thư mục cha, để trống = root)
            </label>
            <input
              id="new-item-folder"
              type="text"
              className="new-item-input"
              placeholder="notes/subfolder"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              disabled={creating || success}
              autoComplete="off"
            />
          </div>

          {/* Path preview */}
          {fullPathPreview && (
            <div className="new-item-preview">
              <span className="new-item-preview-label">Đường dẫn đầy đủ:</span>
              <code className="new-item-preview-path">{repo}/{fullPathPreview}</code>
            </div>
          )}

          {/* Draft notice */}
          <div className="new-item-draft-notice">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Sẽ lưu vào <strong>nháp</strong> — dùng nút <strong>Upload</strong> để đẩy lên GitHub
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="new-item-error" role="alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="new-item-footer">
          <span className="new-item-shortcut">Ctrl+Enter để tạo</span>
          <div className="new-item-actions">
            <button className="new-item-cancel-btn" onClick={onClose} disabled={creating}>
              Hủy
            </button>
            <button
              id="new-item-create-btn"
              className={`new-item-create-btn ${success ? 'new-item-create-success' : ''}`}
              onClick={handleCreate}
              disabled={creating || !name.trim() || success}
            >
              {success ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Đã lưu nháp!
                </>
              ) : creating ? (
                <>
                  <div className="new-item-spinner new-item-spinner-white" />
                  Đang lưu…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Tạo {type === 'document' ? 'tài liệu' : 'thư mục'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
