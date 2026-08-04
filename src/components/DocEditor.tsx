import './DocEditor.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import CommitModal from './CommitModal';
import type { DocEntry, DraftEntry } from '../lib/firestore';
import { updateDraftContent, saveDraft } from '../lib/firestore';

interface DocEditorProps {
  doc: DocEntry;
  isDraft?: boolean;
  draftMeta?: Pick<DraftEntry, 'repo' | 'path' | 'title' | 'type' | 'branch'>;
  onCommitSuccess?: (newSha: string) => void;
  onExitEdit?: () => void;
}

const DRAFT_KEY_PREFIX = 'notemine_draft__';
const AUTOSAVE_DELAY_MS = 2000;

function getDraftKey(docId: string): string {
  return `${DRAFT_KEY_PREFIX}${docId}`;
}

function saveDraftToStorage(docId: string, content: string): void {
  try {
    localStorage.setItem(getDraftKey(docId), JSON.stringify({
      content,
      savedAt: Date.now(),
    }));
  } catch {
    // localStorage đầy hoặc unavailable
  }
}

function loadDraftFromStorage(docId: string): { content: string; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(getDraftKey(docId));
    if (!raw) return null;
    return JSON.parse(raw) as { content: string; savedAt: number };
  } catch {
    return null;
  }
}

function clearDraftFromStorage(docId: string): void {
  try {
    localStorage.removeItem(getDraftKey(docId));
  } catch { /* ignore */ }
}

type FirebaseSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function DocEditor({ doc, isDraft, draftMeta, onCommitSuccess, onExitEdit }: DocEditorProps) {
  const [content, setContent] = useState(doc.content || '');
  const [isDirty, setIsDirty] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [currentSha, setCurrentSha] = useState(doc.sha || '');
  const [fbSaveStatus, setFbSaveStatus] = useState<FirebaseSaveStatus>('idle');
  const fbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  // Kiểm tra draft khi mount
  useEffect(() => {
    const draft = loadDraftFromStorage(doc.id);
    if (draft && draft.content !== doc.content) {
      setContent(draft.content);
      setIsDirty(true);
      setDraftRestored(true);
      setLastSavedAt(draft.savedAt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  // Auto-save draft khi content thay đổi
  useEffect(() => {
    if (!isDirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveDraftToStorage(doc.id, contentRef.current);
      setLastSavedAt(Date.now());
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [content, isDirty, doc.id]);

  // Lưu draft ngay khi đóng tab/window
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        saveDraftToStorage(doc.id, contentRef.current);
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, doc.id]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsDirty(e.target.value !== doc.content);
    setDraftRestored(false);
  }, [doc.content]);

  const handleDiscardDraft = useCallback(() => {
    setContent(doc.content || '');
    setIsDirty(false);
    setDraftRestored(false);
    clearDraftFromStorage(doc.id);
  }, [doc.content, doc.id]);

  const handleCommitSuccess = useCallback((newSha: string) => {
    setCurrentSha(newSha);
    setIsDirty(false);
    clearDraftFromStorage(doc.id);
    onCommitSuccess?.(newSha);
  }, [doc.id, onCommitSuccess]);

  const handleSaveDraftToFirebase = useCallback(async () => {
    if (fbSaveStatus === 'saving') return;
    setFbSaveStatus('saving');
    try {
      if (isDraft) {
        // Draft đã có trong Firestore — cập nhật content
        await updateDraftContent(doc.id, content);
      } else {
        // Synced doc đang chỉnh sửa — tạo/cập nhật DraftEntry
        await saveDraft({
          repo: draftMeta?.repo ?? doc.repo,
          path: draftMeta?.path ?? doc.path,
          title: draftMeta?.title ?? doc.title,
          content,
          type: draftMeta?.type ?? 'document',
          branch: draftMeta?.branch ?? 'main',
        });
      }
      // Cũng lưu localStorage để đồng bộ
      saveDraftToStorage(doc.id, content);
      setLastSavedAt(Date.now());
      setFbSaveStatus('saved');
      // Reset về idle sau 2.5s
      if (fbSaveTimerRef.current) clearTimeout(fbSaveTimerRef.current);
      fbSaveTimerRef.current = setTimeout(() => setFbSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('[DocEditor] saveDraftToFirebase failed:', err);
      setFbSaveStatus('error');
      if (fbSaveTimerRef.current) clearTimeout(fbSaveTimerRef.current);
      fbSaveTimerRef.current = setTimeout(() => setFbSaveStatus('idle'), 3000);
    }
  }, [fbSaveStatus, isDraft, doc.id, doc.repo, doc.path, doc.title, content, draftMeta]);

  function formatSavedTime(ts: number): string {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 5) return 'vừa xong';
    if (s < 60) return `${s}s trước`;
    return `${Math.floor(s / 60)}m trước`;
  }

  return (
    <div className="doc-editor">
      {/* Draft restored banner */}
      {draftRestored && (
        <div className="doc-editor-draft-banner" role="status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>
            Đã khôi phục nháp tự động
            {lastSavedAt && <> · Lưu {formatSavedTime(lastSavedAt)}</>}
          </span>
          <button className="doc-editor-draft-discard" onClick={handleDiscardDraft}>
            Bỏ nháp
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="doc-editor-toolbar">
        <div className="doc-editor-toolbar-left">
          {isDirty && (
            <span className="doc-editor-dirty-badge">
              <span className="doc-editor-dirty-dot" />
              Chưa commit
              {lastSavedAt && !draftRestored && (
                <span className="doc-editor-autosave-hint">
                  · Nháp đã lưu {formatSavedTime(lastSavedAt)}
                </span>
              )}
            </span>
          )}
        </div>

        <div className="doc-editor-toolbar-right">
          {/* Preview toggle */}
          <div className="doc-editor-view-toggle">
            <button
              className={`doc-editor-view-btn ${!isPreview ? 'active' : ''}`}
              onClick={() => setIsPreview(false)}
              title="Chế độ chỉnh sửa"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
            <button
              className={`doc-editor-view-btn ${isPreview ? 'active' : ''}`}
              onClick={() => setIsPreview(true)}
              title="Chế độ xem trước"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Preview
            </button>
          </div>

          {/* Exit button */}
          {onExitEdit && (
            <button className="doc-editor-exit-btn" onClick={onExitEdit} title="Thoát chỉnh sửa">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Đóng
            </button>
          )}

          {/* Save Draft to Firebase button */}
          <button
            id="doc-editor-save-draft-btn"
            className={`doc-editor-save-draft-btn doc-editor-save-draft-btn--${fbSaveStatus}`}
            onClick={handleSaveDraftToFirebase}
            disabled={fbSaveStatus === 'saving' || !isDirty}
            title={
              fbSaveStatus === 'saving' ? 'Đang lưu…' :
              fbSaveStatus === 'saved' ? 'Đã lưu nháp vào Firebase!' :
              fbSaveStatus === 'error' ? 'Lưu thất bại, thử lại' :
              !isDirty ? 'Không có thay đổi' : 'Lưu nháp vào Firebase'
            }
          >
            {fbSaveStatus === 'saving' && (
              <svg className="doc-editor-save-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
            {fbSaveStatus === 'saved' && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {fbSaveStatus === 'error' && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
            {fbSaveStatus === 'idle' && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            )}
            {fbSaveStatus === 'saving' ? 'Đang lưu…' :
             fbSaveStatus === 'saved' ? 'Đã lưu!' :
             fbSaveStatus === 'error' ? 'Lỗi!' :
             'Lưu nháp'}
          </button>

          {/* Commit button */}
          <button
            id="doc-editor-commit-btn"
            className="doc-editor-commit-btn"
            onClick={() => setShowCommitModal(true)}
            disabled={!isDirty}
            title={isDirty ? 'Commit lên GitHub' : 'Không có thay đổi'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            Commit
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="doc-editor-body">
        {isPreview ? (
          <div className="doc-editor-preview">
            <MarkdownRenderer content={content} />
          </div>
        ) : (
          <textarea
            id="doc-editor-textarea"
            className="doc-editor-textarea"
            value={content}
            onChange={handleContentChange}
            placeholder="Nhập nội dung Markdown tại đây…"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        )}
      </div>

      {/* Commit Modal */}
      <CommitModal
        isOpen={showCommitModal}
        onClose={() => setShowCommitModal(false)}
        docPath={doc.path}
        docRepo={doc.repo}
        docSha={currentSha}
        content={content}
        onCommitSuccess={handleCommitSuccess}
      />
    </div>
  );
}
