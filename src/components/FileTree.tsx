import './FileTree.css';
import { useState } from 'react';
import type { DocEntry } from '../lib/firestore';
import type { TreeNode } from './layout/Sidebar';

interface FileTreeProps {
  nodes: TreeNode[];
  activeDocId?: string;
  onSelectDoc: (doc: DocEntry) => void;
  depth?: number;
  isFiltering?: boolean;
}

export default function FileTree({
  nodes,
  activeDocId,
  onSelectDoc,
  depth = 0,
  isFiltering = false,
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
}: {
  node: TreeNode;
  activeDocId?: string;
  onSelectDoc: (doc: DocEntry) => void;
  depth: number;
  isFiltering?: boolean;
}) {
  const [manualOpen, setManualOpen] = useState(depth < 1); // Auto-open first level
  const open = isFiltering ? true : manualOpen;
  const isActive = node.doc && node.doc.id === activeDocId;

  if (node.isDir) {
    return (
      <div className="tree-dir">
        <button
          className={`tree-item tree-dir-toggle ${open ? 'open' : ''}`}
          onClick={() => setManualOpen(!open)}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
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
          <span className="tree-label">{node.name}</span>
        </button>

        <div className={`tree-children ${open ? 'tree-children-open' : ''}`}>
          {open && (
            <FileTree
              nodes={node.children}
              activeDocId={activeDocId}
              onSelectDoc={onSelectDoc}
              depth={depth + 1}
              isFiltering={isFiltering}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      className={`tree-item tree-file ${isActive ? 'tree-item-active' : ''}`}
      onClick={() => node.doc && onSelectDoc(node.doc)}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      title={node.path}
    >
      <span className="tree-icon tree-icon-file" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </span>
      <span className="tree-label">{node.name}</span>
    </button>
  );
}
