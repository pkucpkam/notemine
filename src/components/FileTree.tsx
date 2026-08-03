import './FileTree.css';
import { useState, useRef, useEffect } from 'react';
import type { DocEntry } from '../lib/firestore';
import type { Timestamp } from 'firebase/firestore';
import type { TreeNode } from './layout/Sidebar';

interface FileTreeProps {
  nodes: TreeNode[];
  activeDocId?: string;
  onSelectDoc: (doc: DocEntry) => void;
  depth?: number;
  isFiltering?: boolean;
  onNewDocInFolder?: (folderPath: string) => void;
  onNewFolderInFolder?: (folderPath: string) => void;
}

export default function FileTree({
  nodes,
  activeDocId,
  onSelectDoc,
  depth = 0,
  isFiltering = false,
  onNewDocInFolder,
  onNewFolderInFolder,
}: FileTreeProps) {
  return (
    <div className="file-tree" style={{ '--depth': depth } as React.CSSProperties}>
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          activeDocId={activeDocId}
          onSelectDoc={onSelectDoc}
          depth={depth}
          isFiltering={isFiltering}
          onNewDocInFolder={onNewDocInFolder}
          onNewFolderInFolder={onNewFolderInFolder}
        />
      ))}
    </div>
  );
}

function FileTreeNode({
  node,
  activeDocId,
  onSelectDoc,
  depth,
  isFiltering = false,
  onNewDocInFolder,
  onNewFolderInFolder,
}: {
  node: TreeNode;
  activeDocId?: string;
  onSelectDoc: (doc: DocEntry) => void;
  depth: number;
  isFiltering?: boolean;
  onNewDocInFolder?: (folderPath: string) => void;
  onNewFolderInFolder?: (folderPath: string) => void;
}) {
  const [manualOpen, setManualOpen] = useState(depth < 1);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = isFiltering ? true : manualOpen;
  const isActive = node.doc && node.doc.id === activeDocId;
  const isDraft = !!node.isDraft;

  // Đóng context menu khi click ra ngoài
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  if (node.isDir) {
    return (
      <div className={`tree-dir ${isDraft ? 'tree-dir-draft' : ''}`}>
        <div className="tree-dir-row">
          <button
            className={`tree-item tree-dir-toggle ${open ? 'open' : ''} ${isDraft ? 'tree-item-draft' : ''}`}
            onClick={() => setManualOpen(!open)}
            style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: '4px' }}
          >
            <span className="tree-chevron" aria-hidden="true">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="tree-icon tree-icon-folder" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
            </span>
            <span className="tree-label">
              {node.name}
              {isDraft && (
                <span className="tree-draft-badge" title="Chưa upload lên GitHub">draft</span>
              )}
            </span>
          </button>

          {/* Folder context menu trigger */}
          {(onNewDocInFolder || onNewFolderInFolder) && (
            <div className="tree-folder-actions" ref={menuRef}>
              <button
                className="tree-folder-more-btn"
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                title="Thêm vào thư mục"
                aria-label="Folder actions"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
                </svg>
              </button>
              {showMenu && (
                <div className="tree-folder-menu">
                  {onNewDocInFolder && (
                    <button
                      className="tree-folder-menu-item"
                      onClick={() => { setShowMenu(false); onNewDocInFolder(node.path); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                      Tài liệu mới tại đây
                    </button>
                  )}
                  {onNewFolderInFolder && (
                    <button
                      className="tree-folder-menu-item"
                      onClick={() => { setShowMenu(false); onNewFolderInFolder(node.path); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                        <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
                      </svg>
                      Thư mục mới tại đây
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`tree-children ${open ? 'tree-children-open' : ''}`}>
          {open && (
            <FileTree
              nodes={node.children}
              activeDocId={activeDocId}
              onSelectDoc={onSelectDoc}
              depth={depth + 1}
              isFiltering={isFiltering}
              onNewDocInFolder={onNewDocInFolder}
              onNewFolderInFolder={onNewFolderInFolder}
            />
          )}
        </div>
      </div>
    );
  }

  // File node (doc hoặc draft)
  function handleFileClick() {
    if (node.doc) {
      onSelectDoc(node.doc);
    } else if (node.draft && node.draft.type === 'document') {
      // Tạo DocEntry tạm từ draft để navigate
      const tempDoc: DocEntry = {
        id: node.draft.id,
        repo: node.draft.repo,
        path: node.draft.path,
        title: node.draft.title,
        content: node.draft.content,
        sha: '',
        headings: [],
        frontmatter: {},
        updatedAt: node.draft.updatedAt as Timestamp | null,
      };
      onSelectDoc(tempDoc);
    }
  }

  return (
    <button
      className={`tree-item tree-file ${isActive ? 'tree-item-active' : ''} ${isDraft ? 'tree-item-draft' : ''}`}
      onClick={handleFileClick}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      title={isDraft ? `${node.path} — Nháp, chưa upload lên GitHub` : node.path}
    >
      <span className={`tree-icon ${isDraft ? 'tree-icon-file-draft' : 'tree-icon-file'}`} aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </span>
      <span className="tree-label">
        {node.name}
        {isDraft && (
          <span className="tree-draft-dot" aria-label="Nháp chưa upload" title="Chưa upload lên GitHub" />
        )}
      </span>
    </button>
  );
}
