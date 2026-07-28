import './SearchBar.css';
import { useState, useRef, useCallback, useEffect } from 'react';
import { searchDocs, type SearchResult } from '../lib/search';
import type { DocEntry } from '../lib/firestore';

interface SearchBarProps {
  onFocus?: () => void;
  onBlur?: () => void;
  onSelectDoc: (doc: DocEntry) => void;
}

export default function SearchBar({ onFocus, onBlur, onSelectDoc }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setResults(searchDocs(q, 15));
    setActiveIdx(-1);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 250);
  }, [runSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }, [results, activeIdx]);

  function handleSelect(result: SearchResult) {
    // Build a minimal DocEntry for navigation
    onSelectDoc({ id: result.id, repo: result.repo, path: result.path, title: result.title } as DocEntry);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function highlightMatch(text: string, q: string): string {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      text.slice(0, idx) +
      `<mark>${text.slice(idx, idx + q.length)}</mark>` +
      text.slice(idx + q.length)
    );
  }

  return (
    <div className="search-bar-wrap">
      <div className={`search-bar-input-wrap ${open ? 'focused' : ''}`}>
        <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          id="search-bar-input"
          className="search-bar-input"
          type="search"
          placeholder="Search…"
          value={query}
          onChange={handleChange}
          onFocus={() => { setOpen(true); onFocus?.(); }}
          onBlur={() => { setTimeout(() => { setOpen(false); onBlur?.(); }, 150); }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search documents"
        />
        {query && (
          <button
            className="search-clear-btn"
            onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
            tabIndex={-1}
            aria-label="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="search-dropdown" role="listbox">
          {results.map((r, i) => (
            <button
              key={r.id}
              className={`search-result-item ${i === activeIdx ? 'active' : ''}`}
              onClick={() => handleSelect(r)}
              role="option"
              aria-selected={i === activeIdx}
            >
              <div className="search-result-title"
                dangerouslySetInnerHTML={{ __html: highlightMatch(r.title || r.path, query) }}
              />
              <div className="search-result-path text-faint text-eyebrow">{r.repo} · {r.path}</div>
              {r.excerpt && r.matchType === 'content' && (
                <div className="search-result-excerpt text-caption text-muted"
                  dangerouslySetInnerHTML={{ __html: highlightMatch(r.excerpt, query) }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {open && query && results.length === 0 && (
        <div className="search-dropdown search-no-results">
          <span className="text-caption text-faint">No results for "<strong>{query}</strong>"</span>
        </div>
      )}
    </div>
  );
}
