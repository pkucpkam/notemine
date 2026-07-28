import './SyncStatus.css';
import { useState } from 'react';
import type { SyncMeta } from '../lib/firestore';
import { syncAllRepos } from '../lib/github-sync';
import { saveGitHubToken, getGitHubToken } from '../lib/github-token';

interface SyncStatusProps {
  syncMeta: SyncMeta;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function SyncStatus({ syncMeta }: SyncStatusProps) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);

  const lastSync = syncMeta.lastSyncAt?.toDate?.();
  const status = syncing ? 'syncing' : syncMeta.lastSyncStatus;

  async function handleSync() {
    setSyncing(true);
    setError('');
    setProgress('');
    try {
      // Kiểm tra đã có token chưa
      const token = await getGitHubToken();
      if (!token) {
        setShowTokenInput(true);
        setSyncing(false);
        return;
      }
      const total = await syncAllRepos((msg) => setProgress(msg));
      setProgress(`✓ Đã sync ${total} files`);
      setTimeout(() => setProgress(''), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'NO_TOKEN') {
        setShowTokenInput(true);
      } else if (msg === 'NO_REPOS') {
        setError('Chưa cấu hình repo trong .env');
      } else {
        setError(msg.slice(0, 80));
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveToken() {
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    try {
      await saveGitHubToken(tokenInput.trim());
      setShowTokenInput(false);
      setTokenInput('');
      // Auto-trigger sync sau khi lưu token
      handleSync();
    } catch {
      setError('Không lưu được token');
    } finally {
      setSavingToken(false);
    }
  }

  return (
    <div className="sync-status">
      {/* Token input modal */}
      {showTokenInput && (
        <div className="sync-token-prompt">
          <p className="sync-token-label text-caption">
            Nhập GitHub PAT để sync
          </p>
          <input
            type="password"
            className="sync-token-input"
            placeholder="ghp_xxxxxxxxxxxx"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveToken()}
            autoFocus
          />
          <div className="sync-token-actions">
            <button
              className="sync-token-cancel text-caption text-faint"
              onClick={() => setShowTokenInput(false)}
            >
              Hủy
            </button>
            <button
              className="sync-token-save text-caption"
              onClick={handleSaveToken}
              disabled={savingToken || !tokenInput.trim()}
            >
              {savingToken ? 'Đang lưu…' : 'Lưu & Sync'}
            </button>
          </div>
          <p className="sync-token-hint text-eyebrow text-faint">
            Token được lưu trong Firestore (riêng tư, chỉ bạn đọc được)
          </p>
        </div>
      )}

      <div className="sync-status-row">
        <div className={`sync-dot sync-dot-${status}`} aria-hidden="true" />
        <span className="sync-status-text text-caption text-faint">
          {progress || (
            <>
              {status === 'syncing' && 'Syncing…'}
              {status === 'success' && lastSync && `Synced ${formatRelativeTime(lastSync)}`}
              {status === 'error' && 'Sync error'}
              {status === 'idle' && 'Not synced yet'}
            </>
          )}
        </span>
        <button
          className="sync-now-btn text-eyebrow"
          onClick={() => { setShowTokenInput(!showTokenInput); setError(''); }}
          title="Đổi GitHub Token"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-2-2l2 2m7 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            <circle cx="7.5" cy="15.5" r="2.5" />
            <path d="M9.5 13.5L16 7M14.5 8.5L16 10" />
          </svg>
        </button>
        <button
          id="sync-now-btn"
          className="sync-now-btn text-eyebrow"
          onClick={handleSync}
          disabled={syncing}
          title="Sync now"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={syncing ? 'spin' : ''}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
      </div>
      {error && <div className="sync-error text-caption">{error}</div>}
    </div>
  );
}
