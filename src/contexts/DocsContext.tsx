import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  type DocEntry,
  type DraftEntry,
  type SyncMeta,
  subscribeDocs,
  subscribeSyncMeta,
  subscribeDrafts,
} from '../lib/firestore';
import { buildSearchIndex } from '../lib/search';

interface DocsContextValue {
  docs: DocEntry[];
  drafts: DraftEntry[];
  syncMeta: SyncMeta;
  loading: boolean;
  getDocById: (id: string) => DocEntry | undefined;
  getDocsByRepo: (repo: string) => DocEntry[];
}

const DocsContext = createContext<DocsContextValue>({
  docs: [],
  drafts: [],
  syncMeta: { lastSyncAt: null, lastSyncStatus: 'idle' },
  loading: true,
  getDocById: () => undefined,
  getDocsByRepo: () => [],
});

export function DocsProvider({ children }: { children: ReactNode }) {
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [syncMeta, setSyncMeta] = useState<SyncMeta>({
    lastSyncAt: null,
    lastSyncStatus: 'idle',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub1 = subscribeDocs((d) => {
      setDocs(d);
      buildSearchIndex(d);
      setLoading(false);
    });
    const unsub2 = subscribeSyncMeta(setSyncMeta);
    const unsub3 = subscribeDrafts(setDrafts);
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  const getDocById = useCallback(
    (id: string) => docs.find((d) => d.id === id),
    [docs]
  );

  const getDocsByRepo = useCallback(
    (repo: string) => docs.filter((d) => d.repo === repo),
    [docs]
  );

  return (
    <DocsContext.Provider value={{ docs, drafts, syncMeta, loading, getDocById, getDocsByRepo }}>
      {children}
    </DocsContext.Provider>
  );
}

// eslint-disable-next-line react/only-export-components
export function useDocs() {
  return useContext(DocsContext);
}
