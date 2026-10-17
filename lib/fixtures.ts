export type Player = { id: string; name: string; flat?: string; team?: string; [k: string]: unknown };
export type Match = {
  id: string; sport: string; category: string; round: string; roundOrder?: number;
  date?: string; time?: string; venue?: string; p1: string; p2: string;
  status: string; winner?: string; score?: string; sourceSheet?: number; [k: string]: unknown;
};
export type Tournament = { players: Player[]; matches: Match[]; [k: string]: unknown };
export type Round = { name: string; order: number; matches: Match[] };
export type Side = 'p1' | 'p2';
export type SlotRef = { id: string; side: Side };

export const teamCode = (t?: string) => (t === 'BI' ? 'WZ' : t ? 'HK' : '');
export const matchNo = (id: string) => Number(id.match(/-m(\d+)$/)?.[1] ?? 0);
export const roundName = (count: number, index: number) =>
  count === 1 ? 'Final' : count === 2 ? 'Semi-final' : count === 4 ? 'Quarter-final' : `Round ${index + 1}`;

export function resolveSlot(matches: Match[], id: string, seen = new Set<string>()): string {
  if (!id || id === 'BYE' || !id.startsWith('winner:')) return id || '';
  const mid = id.slice(7);
  if (seen.has(mid)) return '';
  seen.add(mid);
  const m = matches.find(x => x.id === mid);
  if (!m) return '';
  if (m.status === 'completed' && m.winner) return resolveSlot(matches, m.winner, seen);
  const a = resolveSlot(matches, m.p1, new Set(seen)), b = resolveSlot(matches, m.p2, new Set(seen));
  if (a === 'BYE') return b;
  if (b === 'BYE') return a;
  return id;
}

export function categoriesOf(matches: Match[], sport: string) {
  const list: string[] = [];
  for (const m of matches) if (m.sport === sport && !list.includes(m.category)) list.push(m.category);
  return list;
}

export function roundsOf(matches: Match[], sport: string, category: string): Round[] {
  const map = new Map<number, Round>();
  for (const m of matches) {
    if (m.sport !== sport || m.category !== category) continue;
    const order = m.roundOrder ?? 1;
    const r = map.get(order) ?? { name: m.round, order, matches: [] };
    r.matches.push(m);
    map.set(order, r);
  }
  const list = [...map.values()].sort((a, b) => a.order - b.order);
  list.forEach(r => r.matches.sort((a, b) => matchNo(a.id) - matchNo(b.id)));
  return list;
}

/** Derives status/winner from the slots: a BYE advances the other side, a winner means completed. */
export function settle(m: Match): Match {
  if (m.p1 === 'BYE' || m.p2 === 'BYE') {
    const other = m.p1 === 'BYE' ? m.p2 : m.p1;
    return { ...m, status: 'bye', winner: other && other !== 'BYE' ? other : '', score: '' };
  }
  return { ...m, status: m.winner ? 'completed' : 'scheduled' };
}

/** Resets results of every later match fed (directly or indirectly) by the changed matches. */
export function clearDownstream(matches: Match[], ids: string[]): Match[] {
  const changed = new Set(ids);
  const out = matches.map(m => ({ ...m }));
  let added = true;
  while (added) {
    added = false;
    for (const m of out) {
      if (changed.has(m.id)) continue;
      if ([m.p1, m.p2].some(v => v?.startsWith('winner:') && changed.has(v.slice(7)))) {
        changed.add(m.id);
        if (m.status === 'completed') { m.winner = ''; m.score = ''; }
        Object.assign(m, settle(m));
        added = true;
      }
    }
  }
  return out;
}

function refsValid(matches: Match[], m: Match) {
  return [m.p1, m.p2].every(v => {
    if (!v?.startsWith('winner:')) return true;
    const src = matches.find(x => x.id === v.slice(7));
    return !!src && src.sport === m.sport && src.category === m.category && (src.roundOrder ?? 1) < (m.roundOrder ?? 1);
  });
}

export function swapSlots(matches: Match[], a: SlotRef, b: SlotRef): Match[] | string {
  const out = matches.map(m => ({ ...m }));
  const ma = out.find(m => m.id === a.id), mb = out.find(m => m.id === b.id);
  if (!ma || !mb) return 'Match not found.';
  const va = ma[a.side], vb = mb[b.side];
  ma[a.side] = vb;
  mb[b.side] = va;
  if (!refsValid(out, ma) || !refsValid(out, mb)) return 'A "Winner of …" slot can only feed a later round of the same category.';
  for (const m of new Set([ma, mb])) {
    if (ma !== mb) { m.winner = ''; m.score = ''; }
    Object.assign(m, settle(m));
  }
  return ma === mb ? out : clearDownstream(out, [ma.id, mb.id]);
}

const CONTENT_KEYS = ['date', 'time', 'venue', 'p1', 'p2', 'status', 'winner', 'score'] as const;

/** Moves a fixture up/down inside its round by swapping it with the neighbouring slot. */
export function moveMatch(matches: Match[], id: string, dir: -1 | 1): Match[] {
  const m = matches.find(x => x.id === id);
  if (!m) return matches;
  const round = roundsOf(matches, m.sport, m.category).find(r => r.order === (m.roundOrder ?? 1));
  const i = round?.matches.findIndex(x => x.id === id) ?? -1;
  const n = round?.matches[i + dir];
  if (!n) return matches;
  const out = matches.map(x => {
    const src = x.id === m.id ? n : x.id === n.id ? m : null;
    if (!src) return x;
    const next = { ...x };
    for (const k of CONTENT_KEYS) (next as Record<string, unknown>)[k] = src[k];
    return next;
  });
  return clearDownstream(out, [m.id, n.id]);
}

export function deleteMatches(matches: Match[], ids: string[]): Match[] {
  const gone = new Set(ids);
  const touched: string[] = [];
  const out = matches.filter(m => !gone.has(m.id)).map(m => {
    const next = { ...m };
    for (const side of ['p1', 'p2'] as const) {
      if (next[side]?.startsWith('winner:') && gone.has(next[side].slice(7))) { next[side] = ''; next.winner = ''; next.score = ''; touched.push(m.id); }
    }
    return touched.includes(m.id) ? settle(next) : next;
  });
  return clearDownstream(out, touched);
}

export function nextMatchId(matches: Match[], sport: string, category: string, order: number) {
  const ids = new Set(matches.map(m => m.id));
  const sample = matches.find(m => m.sport === sport && m.category === category && /-r\d+-m\d+$/.test(m.id));
  const base = sample ? sample.id.replace(/-r\d+-m\d+$/, '') : `${sport.replace(/\s+/g, '')}-${Date.now().toString(36)}`;
  let k = 1 + Math.max(0, ...matches.filter(m => m.id.startsWith(`${base}-r${order}-m`)).map(m => matchNo(m.id)));
  while (ids.has(`${base}-r${order}-m${k}`)) k++;
  return `${base}-r${order}-m${k}`;
}

function blank(id: string, sport: string, category: string, round: string, order: number, extra: Partial<Match> = {}): Match {
  return settle({ id, sport, category, round, roundOrder: order, date: '', time: '', venue: '', p1: '', p2: '', status: 'scheduled', winner: '', score: '', ...extra });
}

export function addMatch(matches: Match[], sport: string, category: string, round: { name: string; order: number }): Match[] {
  const sibling = matches.find(m => m.sport === sport && m.category === category && (m.roundOrder ?? 1) === round.order);
  const extra: Partial<Match> = { date: sibling?.date ?? '' };
  if (sibling?.sourceSheet !== undefined) extra.sourceSheet = sibling.sourceSheet;
  return [...matches, blank(nextMatchId(matches, sport, category, round.order), sport, category, round.name, round.order, extra)];
}

/** Adds a round after the last one, fed by the winners of the previous round. */
export function addNextRound(matches: Match[], sport: string, category: string): Match[] | string {
  const rounds = roundsOf(matches, sport, category);
  const last = rounds.at(-1);
  if (!last) return 'Create the category first.';
  if (last.matches.length < 2) return 'The last round has a single match, so it is already the final.';
  const order = last.order + 1, count = Math.ceil(last.matches.length / 2);
  let out = matches;
  for (let k = 0; k < count; k++) {
    const a = last.matches[2 * k], b = last.matches[2 * k + 1];
    const extra: Partial<Match> = { p1: `winner:${a.id}`, p2: b ? `winner:${b.id}` : '' };
    if (a.sourceSheet !== undefined) extra.sourceSheet = a.sourceSheet;
    out = [...out, blank(nextMatchId(out, sport, category, order), sport, category, roundName(count, rounds.length), order, extra)];
  }
  return out;
}

/** Creates a full knockout: first round with empty slots, later rounds wired to winners. */
export function createCategory(matches: Match[], sport: string, category: string, firstRound: number, date = ''): Match[] {
  const base = `${sport.replace(/\s+/g, '')}-${Date.now().toString(36)}`;
  let out = [...matches];
  let prev: Match[] = [];
  for (let count = firstRound, i = 0; count >= 1; count = count === 1 ? 0 : Math.ceil(count / 2), i++) {
    const order = i + 1, name = roundName(count, i);
    const made: Match[] = [];
    for (let k = 0; k < count; k++) {
      const extra: Partial<Match> = { date: i === 0 ? date : '' };
      if (prev.length) { extra.p1 = `winner:${prev[2 * k].id}`; extra.p2 = prev[2 * k + 1] ? `winner:${prev[2 * k + 1].id}` : ''; }
      made.push(blank(`${base}-r${order}-m${k + 1}`, sport, category, name, order, extra));
    }
    out = [...out, ...made];
    prev = made;
  }
  return out;
}

export function renameRound(matches: Match[], sport: string, category: string, order: number, name: string): Match[] {
  return matches.map(m => (m.sport === sport && m.category === category && (m.roundOrder ?? 1) === order ? { ...m, round: name } : m));
}

export function renameCategory(matches: Match[], sport: string, from: string, to: string): Match[] {
  return matches.map(m => (m.sport === sport && m.category === from ? { ...m, category: to } : m));
}

export function duplicatePlayers(matches: Match[], sport: string, category: string) {
  const seen = new Map<string, number>();
  for (const m of matches) {
    if (m.sport !== sport || m.category !== category) continue;
    for (const v of [m.p1, m.p2]) if (v && v !== 'BYE' && !v.startsWith('winner:')) seen.set(v, (seen.get(v) ?? 0) + 1);
  }
  return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
}

export function nextPlayerId(players: Player[]) {
  const ids = new Set(players.map(p => p.id));
  let k = 1 + Math.max(0, ...players.map(p => Number(p.id.match(/^p(\d+)$/)?.[1] ?? 0)));
  while (ids.has(`p${k}`)) k++;
  return `p${k}`;
}
