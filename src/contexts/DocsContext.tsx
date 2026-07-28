import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { type DocEntry, type SyncMeta, subscribeDocs, subscribeSyncMeta } from '../lib/firestore';
import { buildSearchIndex } from '../lib/search';

interface DocsContextValue {
  docs: DocEntry[];
  syncMeta: SyncMeta;
  loading: boolean;
  getDocById: (id: string) => DocEntry | undefined;
  getDocsByRepo: (repo: string) => DocEntry[];
}

const DocsContext = createContext<DocsContextValue>({
  docs: [],
  syncMeta: { lastSyncAt: null, lastSyncStatus: 'idle' },
  loading: true,
  getDocById: () => undefined,
  getDocsByRepo: () => [],
});

export function DocsProvider({ children }: { children: ReactNode }) {
  const [docs, setDocs] = useState<DocEntry[]>([]);
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
    return () => {
      unsub1();
      unsub2();
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
    <DocsContext.Provider value={{ docs, syncMeta, loading, getDocById, getDocsByRepo }}>
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs() {
  return useContext(DocsContext);
}
