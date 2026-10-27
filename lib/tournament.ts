import type { Match, Tournament } from './types';

export const defaultSports = [
  { id: 'table-tennis', name: 'Table Tennis', icon: '🏓' },
  { id: 'badminton', name: 'Badminton', icon: '🏸' },
  { id: 'chess', name: 'Chess', icon: '♟️' },
  { id: 'carroms', name: 'Carroms', icon: '🎯' },
];
export const sportNames = (db: Tournament) => db.sports.map(s => s.name);
export const si = (n: string, db?: Partial<Pick<Tournament, 'sports'>>) => ((db?.sports?.find(s => s.name === n)?.icon || defaultSports.find(s => s.name === n)?.icon || '🏅') + ' ');
export const teamName = (t: string) => (t === 'BI' ? 'MMX Wizardz' : t === 'GL' ? 'Metro Hawks' : 'TBD');
export const teamLogo: Record<string, string> = { BI: '/brand/mmx-wizardz.webp', GL: '/brand/metro-hawks.webp' };
export const statusLabel = (s: string) => (s === 'completed' ? '✅ Done' : s === 'bye' ? 'Bye / advance' : '⏰ Coming up');
export const fmt = (d: string) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date TBD';
export const fmtTime = (t: string) => {
  if (!t) return 'Time TBD';
  const [h, m] = t.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
export const points = (db: Tournament, t: string) => db.awards.filter(a => a.team === t).reduce((s, a) => s + Number(a.points || 0), 0);

/** Resolves a slot (player id, BYE, or `winner:<matchId>`) to the participant who currently fills it. */
export function resolveSlot(db: Tournament, id: string, seen = new Set<string>()): string {
  if (!id || id === 'BYE') return id || '';
  if (!id.startsWith('winner:')) return id;
  const mid = id.slice(7);
  if (seen.has(mid)) return '';
  seen.add(mid);
  const m = db.matches.find(x => x.id === mid);
  if (!m) return '';
  if (m.status === 'completed' && m.winner) return resolveSlot(db, m.winner, seen);
  const a = resolveSlot(db, m.p1, new Set(seen)), b = resolveSlot(db, m.p2, new Set(seen));
  if (a === 'BYE') return b;
  if (b === 'BYE') return a;
  return id;
}

export function slotName(db: Tournament, id: string): string {
  const r = resolveSlot(db, id);
  if (r === 'BYE') return 'BYE';
  if (!r) return 'TBD';
  if (r.startsWith('winner:')) {
    const m = db.matches.find(x => x.id === r.slice(7));
    return m ? 'Winner · ' + m.round + ' · ' + (m.id.split('-').at(-1) || '').toUpperCase() : 'TBD';
  }
  const p = db.players.find(p => p.id === r);
  return p ? `${p.name} · ${teamName(p.team)}` : 'TBD';
}

export const playsIn = (db: Tournament, m: Match, pid: string) =>
  resolveSlot(db, m.p1) === pid || resolveSlot(db, m.p2) === pid || m.winner === pid || m.second === pid || m.third === pid;

/** Clears results of every later match that depends (directly or indirectly) on `mid`. Mutates `db`. */
export function clearDownstream(db: Tournament, mid: string) {
  const changed = new Set([mid]);
  let added = true;
  while (added) {
    added = false;
    for (const m of db.matches) {
      if (changed.has(m.id)) continue;
      if ([m.p1, m.p2].some(v => v.startsWith('winner:') && changed.has(v.slice(7)))) {
        changed.add(m.id);
        m.winner = '';
        m.second = '';
        m.third = '';
        m.score = '';
        m.status = [m.p1, m.p2].includes('BYE') ? 'bye' : 'scheduled';
        added = true;
      }
    }
  }
}

export interface MatchFilter { sport: string; category: string; status: string; date: string; query: string }
export const defaultFilter: MatchFilter = { sport: 'All sports', category: 'All categories', status: 'scheduled', date: '', query: '' };

export function filterMatches(db: Tournament, f: MatchFilter) {
  const q = f.query.toLowerCase();
  return db.matches
    .filter(m =>
      (f.sport === 'All sports' || m.sport === f.sport) &&
      (f.category === 'All categories' || m.category === f.category) &&
      (f.status === 'All statuses' || m.status === f.status) &&
      (!f.date || (f.date === 'TBD' ? !m.date : m.date === f.date)) &&
      (!q || [m.sport, m.category, m.round, slotName(db, m.p1), slotName(db, m.p2), m.date].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => a.date.localeCompare(b.date));
}
