import './Sidebar.css';
import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDocs } from '../../contexts/DocsContext';
import { useAuth } from '../../contexts/AuthContext';
import { signOutUser } from '../../lib/auth';
import SearchBar from '../SearchBar';
import FileTree from '../FileTree';
import SyncStatus from '../SyncStatus';
import type { DocEntry } from '../../lib/firestore';

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
}

function buildTree(docs: DocEntry[]): Record<string, TreeNode[]> {
  const byRepo: Record<string, DocEntry[]> = {};
  for (const doc of docs) {
    if (!byRepo[doc.repo]) byRepo[doc.repo] = [];
    byRepo[doc.repo].push(doc);
  }

  const result: Record<string, TreeNode[]> = {};
  for (const [repo, repoDocs] of Object.entries(byRepo)) {
    const root: TreeNode[] = [];
    const nodeMap: Record<string, TreeNode> = {};

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
    result[repo] = root;
  }
  return result;
}

export default function Sidebar({ onClose, isMobile }: SidebarProps) {
  const { docs, syncMeta, loading } = useDocs();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { docId } = useParams<{ docId: string }>();
  const [filterQuery, setFilterQuery] = useState('');

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

  const tree = useMemo(() => buildTree(filteredDocs), [filteredDocs]);
  const repos = useMemo(() => Object.keys(tree), [tree]);

  const handleDocSelect = useCallback((doc: DocEntry) => {
    navigate(`/doc/${doc.id}`);
    if (isMobile) onClose();
  }, [navigate, isMobile, onClose]);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
    navigate('/login');
  }, [navigate]);

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

      {/* File tree */}
      <div className="sidebar-tree-wrap">
        {loading ? (
          <div className="sidebar-loading">
            <div className="sidebar-loading-dots">
              <span /><span /><span />
            </div>
          </div>
        ) : docs.length === 0 ? (
          <div className="sidebar-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            <p>No documents yet</p>
            <span>Sync a GitHub repo to get started</span>
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
              />
            </div>
          ))
        )}
      </div>

      {/* Sync status at bottom */}
      <div className="sidebar-footer">
        <SyncStatus syncMeta={syncMeta} />
      </div>
    </div>
  );
}
