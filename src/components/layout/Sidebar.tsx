import './Sidebar.css';
import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDocs } from '../../contexts/DocsContext';
import { useAuth } from '../../contexts/AuthContext';
import { signOutUser } from '../../lib/auth';
import SearchBar from '../SearchBar';
import FileTree from '../FileTree';
import SyncStatus from '../SyncStatus';
import UploadDraftsButton from '../UploadDraftsButton';
import NewItemModal, { type NewItemType } from '../NewItemModal';
import DeleteDraftModal from '../DeleteDraftModal';
import type { DocEntry, DraftEntry } from '../../lib/firestore';
import { deleteDraft } from '../../lib/firestore';

interface SidebarProps {
  onClose: () => void;
  isMobile: boolean;
}

// Build a tree structure from flat doc list
export interface TreeNode {
  name: string;
  path: string;
  repo: string;
  isDir: boolean;
  children: TreeNode[];
  doc?: DocEntry;
  isDraft?: boolean;   // node màu xanh lá = chưa upload
  draft?: DraftEntry;  // draft data nếu là draft node
}

function buildTree(
  docs: DocEntry[],
  drafts: DraftEntry[]
): Record<string, TreeNode[]> {
  // Gom theo repo
  const byRepo: Record<string, { docs: DocEntry[]; drafts: DraftEntry[] }> = {};

  for (const doc of docs) {
    if (!byRepo[doc.repo]) byRepo[doc.repo] = { docs: [], drafts: [] };
    byRepo[doc.repo].docs.push(doc);
  }

  // Thêm draft vào đúng repo bucket
  for (const draft of drafts) {
    if (!byRepo[draft.repo]) byRepo[draft.repo] = { docs: [], drafts: [] };
    byRepo[draft.repo].drafts.push(draft);
  }

  const result: Record<string, TreeNode[]> = {};

  for (const [repo, { docs: repoDocs, drafts: repoDrafts }] of Object.entries(byRepo)) {
    const root: TreeNode[] = [];
    const nodeMap: Record<string, TreeNode> = {};

    // Helper để đảm bảo folder tồn tại
    function ensureFolder(parts: string[], upTo: number): string {
      let currentPath = '';
      let currentArr = root;
      for (let i = 0; i < upTo; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!nodeMap[currentPath]) {
          const node: TreeNode = {
            name: part,
            path: currentPath,
            repo,
            isDir: true,
            children: [],
          };
          nodeMap[currentPath] = node;
          currentArr.push(node);
        }
        currentArr = nodeMap[currentPath].children;
      }
      return currentPath;
    }

    // Thêm docs đã sync vào tree
    for (const doc of repoDocs.sort((a, b) => a.path.localeCompare(b.path))) {
      const parts = doc.path.split('/');
      let currentPath = '';
      let currentArr = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLast = i === parts.length - 1;

        if (!nodeMap[currentPath]) {
          const node: TreeNode = {
            name: isLast ? (doc.title || part) : part,
            path: currentPath,
            repo,
            isDir: !isLast,
            children: [],
            doc: isLast ? doc : undefined,
          };
          nodeMap[currentPath] = node;
          currentArr.push(node);
        }
        currentArr = nodeMap[currentPath].children;
      }
    }

    // Thêm drafts vào tree (hiển thị màu xanh lá)
    for (const draft of repoDrafts.sort((a, b) => a.path.localeCompare(b.path))) {
      const parts = draft.path.split('/');
      const isFolder = draft.type === 'folder';

      if (isFolder) {
        // Đảm bảo folder draft được thêm
        ensureFolder(parts, parts.length);
        // Đánh dấu folder node là draft
        const folderPath = parts.join('/');
        if (nodeMap[folderPath]) {
          nodeMap[folderPath].isDraft = true;
          nodeMap[folderPath].draft = draft;
        }
      } else {
        // Document draft
        // Đảm bảo folder cha tồn tại
        if (parts.length > 1) {
          ensureFolder(parts, parts.length - 1);
        }
        const docPath = parts.join('/');
        if (!nodeMap[docPath]) {
          const parentPath = parts.slice(0, -1).join('/');
          const parentArr = parentPath ? nodeMap[parentPath]?.children : root;
          if (parentArr) {
            const node: TreeNode = {
              name: draft.title || parts[parts.length - 1],
              path: docPath,
              repo,
              isDir: false,
              children: [],
              isDraft: true,
              draft,
            };
            nodeMap[docPath] = node;
            parentArr.push(node);
          }
        }
      }
    }

    result[repo] = root;
  }

  return result;
}

export default function Sidebar({ onClose, isMobile }: SidebarProps) {
  const { docs, drafts, syncMeta, loading } = useDocs();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { docId } = useParams<{ docId: string }>();
  const [filterQuery, setFilterQuery] = useState('');
  const [newItemModal, setNewItemModal] = useState<{
    open: boolean;
    type: NewItemType;
    folder: string;
  }>({ open: false, type: 'document', folder: '' });

  const [deleteDraftModal, setDeleteDraftModal] = useState<{
    open: boolean;
    draftId: string;
    draftName: string;
    draftPath: string;
  }>({ open: false, draftId: '', draftName: '', draftPath: '' });

  const isFiltering = filterQuery.trim().length > 0;

  const filteredDocs = useMemo(() => {
    if (!filterQuery.trim()) return docs;
    const q = filterQuery.toLowerCase().trim();
    return docs.filter(
      (doc) =>
        (doc.title && doc.title.toLowerCase().includes(q)) ||
        doc.path.toLowerCase().includes(q) ||
        doc.repo.toLowerCase().includes(q) ||
        (doc.content && doc.content.toLowerCase().includes(q))
    );
  }, [docs, filterQuery]);

  const filteredDrafts = useMemo(() => {
    if (!filterQuery.trim()) return drafts;
    const q = filterQuery.toLowerCase().trim();
    return drafts.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.path.toLowerCase().includes(q)
    );
  }, [drafts, filterQuery]);

  const tree = useMemo(
    () => buildTree(filteredDocs, filteredDrafts),
    [filteredDocs, filteredDrafts]
  );
  const repos = useMemo(() => Object.keys(tree), [tree]);

  const handleDocSelect = useCallback((doc: DocEntry) => {
    navigate(`/doc/${doc.id}`);
    if (isMobile) onClose();
  }, [navigate, isMobile, onClose]);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
    navigate('/login');
  }, [navigate]);

  const handleDeleteDraft = useCallback((draftId: string) => {
    // Tìm draft để lấy name + path hiển thị
    const draft = drafts.find((d) => d.id === draftId);
    setDeleteDraftModal({
      open: true,
      draftId,
      draftName: draft?.title || draftId,
      draftPath: draft?.path || draftId,
    });
  }, [drafts]);

  const handleDeleteDraftConfirm = useCallback(async () => {
    await deleteDraft(deleteDraftModal.draftId);
  }, [deleteDraftModal.draftId]);

  const closeDeleteDraftModal = useCallback(() => {
    setDeleteDraftModal((prev) => ({ ...prev, open: false }));
  }, []);

  const openNewItemModal = useCallback((type: NewItemType, folder = '') => {
    setNewItemModal({ open: true, type, folder });
  }, []);

  const closeNewItemModal = useCallback(() => {
    setNewItemModal((prev) => ({ ...prev, open: false }));
  }, []);

  // Kiểm tra xem có doc/draft nào để hiển thị không
  const hasContent = docs.length > 0 || drafts.length > 0;

  return (
    <div className="sidebar">
      {/* Workspace Header */}
      <div className="sidebar-header">
        <div className="sidebar-workspace">
          <div className="sidebar-workspace-icon">
            <svg width="16" height="16" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <rect width="36" height="36" rx="6" fill="#0075de" />
              <path d="M8 8h6v20H8V8zm8 0h6l8 10-8 10h-6l8-10-8-10z" fill="white" />
            </svg>
          </div>
          <div className="sidebar-workspace-info">
            <span className="sidebar-workspace-name">NoteMine</span>
            <span className="sidebar-workspace-user text-faint text-eyebrow">
              {user?.displayName || user?.email || 'Personal'}
            </span>
          </div>
        </div>

        <button
          id="sidebar-signout-btn"
          className="sidebar-signout-btn"
          onClick={handleSignOut}
          title="Sign out"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>

      {/* Filter Input */}
      <div className="sidebar-search-wrap">
        <SearchBar
          value={filterQuery}
          onChange={setFilterQuery}
          placeholder="Filter files..."
        />
      </div>

      {/* Nav links */}
      <div className="sidebar-nav">
        <button
          className="sidebar-nav-item"
          onClick={() => navigate('/')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          Home
        </button>
      </div>

      {/* Action bar: New doc / New folder */}
      <div className="sidebar-action-bar">
        <button
          id="sidebar-new-doc-btn"
          className="sidebar-action-btn"
          onClick={() => openNewItemModal('document')}
          title="Tạo tài liệu mới"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          Tài liệu
        </button>
        <button
          id="sidebar-new-folder-btn"
          className="sidebar-action-btn"
          onClick={() => openNewItemModal('folder')}
          title="Tạo thư mục mới"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
          </svg>
          Thư mục
        </button>
      </div>

      {/* File tree */}
      <div className="sidebar-tree-wrap">
        {loading ? (
          <div className="sidebar-loading">
            <div className="sidebar-loading-dots">
              <span /><span /><span />
            </div>
          </div>
        ) : !hasContent ? (
          <div className="sidebar-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            <p>No documents yet</p>
            <span>Sync a GitHub repo or create a new document</span>
          </div>
        ) : repos.length === 0 ? (
          <div className="sidebar-empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p>No matching files</p>
            <span>Try a different filter term</span>
          </div>
        ) : (
          repos.map((repo) => (
            <div key={repo} className="sidebar-repo-section">
              <div className="sidebar-repo-label text-eyebrow text-faint">
                {repo.split('/')[1] || repo}
              </div>
              <FileTree
                nodes={tree[repo]}
                activeDocId={docId}
                onSelectDoc={handleDocSelect}
                isFiltering={isFiltering}
                onNewDocInFolder={(folderPath) => openNewItemModal('document', folderPath)}
                onNewFolderInFolder={(folderPath) => openNewItemModal('folder', folderPath)}
                onDeleteDraft={handleDeleteDraft}
              />
            </div>
          ))
        )}
      </div>

      {/* Upload drafts panel — hiện khi có draft */}
      <UploadDraftsButton />

      {/* Sync status at bottom */}
      <div className="sidebar-footer">
        <SyncStatus syncMeta={syncMeta} />
      </div>

      {/* New Item Modal */}
      <NewItemModal
        isOpen={newItemModal.open}
        onClose={closeNewItemModal}
        defaultType={newItemModal.type}
        contextFolder={newItemModal.folder}
        onSuccess={() => {}}
      />

      {/* Delete Draft Modal */}
      <DeleteDraftModal
        isOpen={deleteDraftModal.open}
        draftName={deleteDraftModal.draftName}
        draftPath={deleteDraftModal.draftPath}
        onClose={closeDeleteDraftModal}
        onConfirm={handleDeleteDraftConfirm}
      />
    </div>
  );
}
