'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import seed from '@/data/seed.json';
import type { Tournament, TournamentSnapshot } from '@/lib/types';

interface Ctx {
  db: Tournament; revision: number; ready: boolean; empty: boolean; error: string; admin: boolean; adminConfigured: boolean; saving: boolean;
  refresh(fresh?: boolean): Promise<void>;
  /** Calls a mutating API route and swaps in the returned tournament. Returns true on success; alerts on failure. */
  call(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<boolean>;
  login(key: string): Promise<string | null>;
  logout(): Promise<void>;
}

const TournamentContext = createContext<Ctx | null>(null);

export function useTournament() {
  const c = useContext(TournamentContext);
  if (!c) throw new Error('useTournament must be used inside TournamentProvider');
  return c;
}

export default function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [snap, setSnap] = useState<TournamentSnapshot>({ data: seed as Tournament, revision: 0, empty: false });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [admin, setAdmin] = useState(false);
  const [adminConfigured, setAdminConfigured] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async (fresh = false) => {
    try {
      const r = await fetch('/api/tournament' + (fresh ? '?fresh=1' : ''), { cache: 'no-store' });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setSnap(body);
      setReady(true);
      setError('');
    } catch {
      setError('Shared tournament data could not be loaded. Showing the original schedule.');
    }
  }, []);

  useEffect(() => {
    refresh();
    fetch('/api/auth', { cache: 'no-store' }).then(r => r.json()).then(b => { setAdmin(!!b.admin); setAdminConfigured(!!b.configured); }).catch(() => {});
    const onFocus = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onFocus);
    const t = setInterval(onFocus, 60000);
    return () => { document.removeEventListener('visibilitychange', onFocus); clearInterval(t); };
  }, [refresh]);

  const call = useCallback<Ctx['call']>(async (method, path, body) => {
    setSaving(true);
    try {
      const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const res = await r.json();
      if (r.status === 401) setAdmin(false);
      if (!r.ok) throw new Error(res.error || 'Save failed.');
      setSnap(res);
      setReady(true);
      return true;
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const login = useCallback(async (key: string) => {
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) return b.error || 'Login failed.';
    setAdmin(true);
    await refresh(true);
    return null;
  }, [refresh]);

  const logout = useCallback(async () => { await fetch('/api/auth', { method: 'DELETE' }); setAdmin(false); }, []);

  return (
    <TournamentContext.Provider value={{ db: snap.data, revision: snap.revision, empty: snap.empty, ready, error, admin, adminConfigured, saving, refresh, call, login, logout }}>
      {children}
    </TournamentContext.Provider>
  );
}
