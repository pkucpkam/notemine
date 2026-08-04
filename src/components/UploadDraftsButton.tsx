import './UploadDraftsButton.css';
import { useState, useCallback } from 'react';
import { useDocs } from '../contexts/DocsContext';
import { uploadDraftsToGitHub, deleteDraftFromFirestore, syncAllRepos } from '../lib/github-sync';

export default function UploadDraftsButton() {
  const { drafts } = useDocs();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const docDrafts = drafts.filter((d) => d.type === 'document');
  const folderDrafts = drafts.filter((d) => d.type === 'folder');
  const total = drafts.length;

  const handleDelete = useCallback(async (draftId: string, name: string) => {
    if (!confirm(`Xóa bản nháp "${name}" khỏi hàng chờ?`)) return;
    try {
      await deleteDraftFromFirestore(draftId);
    } catch {
      // silent
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (total === 0 || uploading) return;
    setUploading(true);
    setError('');
    setProgress('');
    setSuccess(false);

    try {
      // uploadDraftsToGitHub tự động chuyển draft -> doc chính thức trong Firestore tức thì
      const results = await uploadDraftsToGitHub(drafts, (msg) => setProgress(msg));

      setSuccess(true);
      setProgress(`✓ Đã upload ${results.length} file`);

      // Đồng bộ background trạng thái sync metadata
      syncAllRepos().catch(() => {});

      setTimeout(() => {
        setSuccess(false);
        setProgress('');
      }, 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'NO_TOKEN') {
        setError('Chưa có GitHub Token. Hãy Sync để thêm token.');
      } else {
        setError(msg.slice(0, 100));
      }
    } finally {
      setUploading(false);
    }
  }, [drafts, total, uploading]);

  if (total === 0) return null;

  return (
    <div className="upload-drafts-wrap">
      {/* File list preview */}
      <div className="upload-drafts-list">
        {docDrafts.slice(0, 5).map((d) => (
          <div key={d.id} className="upload-draft-item upload-draft-doc">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <span className="upload-draft-name">{d.path.split('/').pop()}</span>
            <button
              className="upload-draft-delete"
              title="Xóa bản nháp"
              onClick={(e) => { e.stopPropagation(); handleDelete(d.id, d.path.split('/').pop() || d.path); }}
            >×</button>
          </div>
        ))}
        {folderDrafts.slice(0, 3).map((d) => (
          <div key={d.id} className="upload-draft-item upload-draft-folder">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            <span className="upload-draft-name">{d.path.split('/').pop()}</span>
            <button
              className="upload-draft-delete"
              title="Xóa bản nháp"
              onClick={(e) => { e.stopPropagation(); handleDelete(d.id, d.path.split('/').pop() || d.path); }}
            >×</button>
          </div>
        ))}
        {total > 8 && (
          <div className="upload-draft-more">+{total - 8} file khác</div>
        )}
      </div>

      {/* Progress / Error */}
      {progress && (
        <div className={`upload-drafts-progress ${success ? 'upload-drafts-progress-success' : ''}`}>
          {progress}
        </div>
      )}
      {error && (
        <div className="upload-drafts-error">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Upload button */}
      <button
        id="upload-drafts-btn"
        className={`upload-drafts-btn ${uploading ? 'uploading' : ''} ${success ? 'uploaded' : ''}`}
        onClick={handleUpload}
        disabled={uploading || success}
        title={`Upload ${total} file nháp lên GitHub`}
      >
        {success ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Đã upload!
          </>
        ) : uploading ? (
          <>
            <div className="upload-drafts-spinner" />
            Đang upload…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
            </svg>
            Upload lên GitHub
            <span className="upload-drafts-count">{total}</span>
          </>
        )}
      </button>
    </div>
  );
}
