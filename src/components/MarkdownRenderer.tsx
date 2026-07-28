import './MarkdownRenderer.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

// Custom components mapping Notion-style
const components: Components = {
  // Headings
  h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
  h4: ({ children }) => <h4 className="md-h4">{children}</h4>,

  // Paragraphs
  p: ({ children }) => <p className="md-p">{children}</p>,

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      className="md-link"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
      {href?.startsWith('http') && (
        <svg className="md-link-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      )}
    </a>
  ),

  // Code blocks
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return <code className="md-code-inline" {...props}>{children}</code>;
    }
    return <code className={className} {...props}>{children}</code>;
  },

  pre: ({ children }) => (
    <pre className="md-pre">{children}</pre>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="md-blockquote">{children}</blockquote>
  ),

  // Lists
  ul: ({ children }) => <ul className="md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="md-ol">{children}</ol>,
  li: ({ children, ...props }) => (
    // @ts-expect-error - checked is passed from remark-gfm for task lists
    props.checked !== null && props.checked !== undefined
      ? (
        <li className="md-li md-task-item">
          {/* @ts-expect-error */}
          <span className={`md-checkbox ${props.checked ? 'checked' : ''}`} aria-hidden="true" />
          {children}
        </li>
      )
      : <li className="md-li">{children}</li>
  ),

  // Table
  table: ({ children }) => (
    <div className="md-table-wrap">
      <table className="md-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="md-thead">{children}</thead>,
  th: ({ children }) => <th className="md-th">{children}</th>,
  td: ({ children }) => <td className="md-td">{children}</td>,
  tr: ({ children }) => <tr className="md-tr">{children}</tr>,

  // Horizontal rule
  hr: () => <hr className="md-hr" />,

  // Images
  img: ({ src, alt }) => (
    <img className="md-img" src={src} alt={alt || ''} loading="lazy" />
  ),

  // Strong / em
  strong: ({ children }) => <strong className="md-strong">{children}</strong>,
  em: ({ children }) => <em className="md-em">{children}</em>,

  // Delete (strikethrough)
  del: ({ children }) => <del className="md-del">{children}</del>,
};

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
