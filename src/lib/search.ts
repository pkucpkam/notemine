import type { DocEntry } from './firestore';

// Using a lightweight approach without flexsearch's complex types
let searchIndex: Map<string, DocEntry> = new Map();
let searchData: Array<{ id: string; text: string; title: string; path: string; repo: string }> = [];

export function buildSearchIndex(docs: DocEntry[]) {
  searchIndex = new Map(docs.map((d) => [d.id, d]));
  searchData = docs.map((d) => ({
    id: d.id,
    text: (d.content || '').toLowerCase(),
    title: (d.title || '').toLowerCase(),
    path: (d.path || '').toLowerCase(),
    repo: d.repo || '',
  }));
}

export interface SearchResult {
  id: string;
  title: string;
  path: string;
  repo: string;
  excerpt: string;
  matchType: 'title' | 'content' | 'path';
}

export function searchDocs(query: string, limit = 20): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const item of searchData) {
    if (seen.has(item.id)) continue;

    let matchType: 'title' | 'content' | 'path' | null = null;
    let excerpt = '';

    if (item.title.includes(q)) {
      matchType = 'title';
      const doc = searchIndex.get(item.id);
      excerpt = doc?.content?.slice(0, 120) || '';
    } else if (item.path.includes(q)) {
      matchType = 'path';
      const doc = searchIndex.get(item.id);
      excerpt = doc?.content?.slice(0, 120) || '';
    } else if (item.text.includes(q)) {
      matchType = 'content';
      const idx = item.text.indexOf(q);
      const doc = searchIndex.get(item.id);
      const raw = doc?.content || '';
      const start = Math.max(0, idx - 60);
      const end = Math.min(raw.length, idx + 120);
      excerpt = (start > 0 ? '…' : '') + raw.slice(start, end) + (end < raw.length ? '…' : '');
    }

    if (matchType) {
      results.push({
        id: item.id,
        title: searchIndex.get(item.id)?.title || item.path,
        path: item.path,
        repo: item.repo,
        excerpt,
        matchType,
      });
      seen.add(item.id);
    }

    if (results.length >= limit) break;
  }

  // Sort: title matches first, then path, then content
  return results.sort((a, b) => {
    const order = { title: 0, path: 1, content: 2 };
    return order[a.matchType] - order[b.matchType];
  });
}
