import 'server-only';
import { randomUUID } from 'crypto';
import seed from '@/data/seed.json';
import { clearDownstream } from './tournament';
import { getStore } from './store';
import { ConflictError } from './store/types';
import { COLLECTIONS, type Award, type Collection, type Match, type MatchStatus, type Player, type Rule, type Team, type Tournament, type TournamentSnapshot } from './types';

export class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const seedData = () => structuredClone(seed) as Tournament;
const isEmpty = (d: Tournament) => COLLECTIONS.every(c => !d[c].length);

let cache: { snap: TournamentSnapshot; at: number } | null = null;
const CACHE_MS = Number(process.env.READ_CACHE_MS ?? 3000);

export async function getSnapshot(fresh = false): Promise<TournamentSnapshot> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.snap;
  const { data, revision } = await getStore().load();
  const empty = isEmpty(data);
  const snap = { data: empty ? seedData() : data, revision, empty };
  cache = { snap, at: Date.now() };
  return snap;
}

let queue: Promise<unknown> = Promise.resolve();

/** Loads fresh data, applies `fn`, and writes the changed collections. Serialised per process and retried on revision conflicts.
 *  If `opts.expectedRevision` is supplied, the loaded revision must match it or a 409 conflict is thrown. */
export function mutate(fn: (db: Tournament) => void, opts: { allowEmpty?: boolean; expectedRevision?: number } = {}): Promise<TournamentSnapshot> {
  const run = async () => {
    for (let attempt = 0; ; attempt++) {
      const { data, revision } = await getStore().load();
      if (opts.expectedRevision !== undefined && revision !== opts.expectedRevision) throw new ApiError('Someone else changed the fixtures meanwhile. Press “Discard” to load their version, then redo your edit.', 409);
      if (isEmpty(data) && !opts.allowEmpty) throw new ApiError('The database is empty. Load the built-in schedule from Admin first.', 409);
      const next = structuredClone(data);
      fn(next);
      const changed = COLLECTIONS.filter(c => JSON.stringify(data[c]) !== JSON.stringify(next[c]));
      if (!changed.length) return { data, revision, empty: isEmpty(data) };
      try {
        const rev = await getStore().write(next, changed, revision);
        const snap = { data: next, revision: rev, empty: isEmpty(next) };
        cache = { snap: isEmpty(next) ? { ...snap, data: seedData() } : snap, at: Date.now() };
        return snap;
      } catch (e) {
        if (!(e instanceof ConflictError) || attempt >= 2) throw e instanceof ConflictError ? new ApiError('Someone else saved at the same time. Please try again.', 409) : e;
      }
    }
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

// ---------- validation ----------
const str = (v: unknown, max = 250) => String(v ?? '').trim().slice(0, max);
const team = (v: unknown, allowBlank = true): Team => {
  const t = str(v);
  if (t === 'BI' || t === 'GL' || (allowBlank && t === '')) return t as Team;
  throw new ApiError('Team must be BI (MMX Wizardz) or GL (Metro Hawks).');
};
const num = (v: unknown, label: string, min = 0, max = 10000) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new ApiError(`${label} must be a number between ${min} and ${max}.`);
  return n;
};
const required = (v: string, label: string) => { if (!v) throw new ApiError(`${label} is required.`); return v; };

export interface CollectionSpec<T> {
  collection: Collection;
  key: keyof T & string;
  newId?: () => string;
  build(body: Record<string, unknown>, db: Tournament, existing?: T): T;
  afterUpdate?(db: Tournament, before: T, after: T): void;
  beforeDelete?(db: Tournament, item: T): void;
}

export const players: CollectionSpec<Player> = {
  collection: 'players', key: 'id', newId: () => 'participant-' + randomUUID(),
  build: (b, _db, ex) => ({ ...ex, id: ex?.id || '', name: required(str(b.name), 'Name'), flat: str(b.flat, 50), team: team(b.team) }),
  beforeDelete(db, p) {
    for (const m of db.matches) {
      if (![m.p1, m.p2, m.winner].includes(p.id)) continue;
      if (m.p1 === p.id) m.p1 = '';
      if (m.p2 === p.id) m.p2 = '';
      if (m.winner === p.id) { m.winner = ''; m.score = ''; }
      if (!m.winner) m.status = 'scheduled';
      clearDownstream(db, m.id);
    }
  },
};

export const matches: CollectionSpec<Match> = {
  collection: 'matches', key: 'id', newId: () => 'custom-' + randomUUID(),
  build(b, db, ex) {
    const slot = (v: unknown) => {
      const s = str(v, 300);
      if (!s || s === 'BYE') return s;
      if (s.startsWith('winner:') ? !db.matches.some(m => m.id === s.slice(7)) : !db.players.some(p => p.id === s)) throw new ApiError(`Unknown participant or match: ${s}`);
      return s;
    };
    const status = str(b.status) as MatchStatus;
    if (!['scheduled', 'completed', 'bye'].includes(status)) throw new ApiError('Status must be scheduled, completed or bye.');
    const p1 = slot(b.p1), p2 = slot(b.p2);
    if (p1 && p1 === p2 && p1 !== 'BYE') throw new ApiError('Choose two different participants.');
    const winner = status === 'completed' ? str(b.winner, 300) : status === 'bye' ? (p1 === 'BYE' ? p2 : p1) : '';
    if (status === 'completed' && !winner) throw new ApiError('Choose a winner before completing this match.');
    if (status === 'bye' && ![p1, p2].includes('BYE')) throw new ApiError('A bye requires one BYE slot.');
    const date = str(b.date, 10), time = str(b.time, 5);
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError('Date must be YYYY-MM-DD.');
    if (time && !/^\d{2}:\d{2}$/.test(time)) throw new ApiError('Time must be HH:mm.');
    return {
      ...ex, id: ex?.id || '', sport: required(str(b.sport, 50), 'Sport'), category: required(str(b.category), 'Category'),
      round: required(str(b.round, 100), 'Round'), roundOrder: num(b.roundOrder ?? 1, 'Round order', 1, 20), date, time,
      venue: str(b.venue, 200), p1, p2, status, winner, score: str(b.score, 500), sourceSheet: ex?.sourceSheet ?? '',
    };
  },
  afterUpdate(db, before, after) {
    if (before.p1 !== after.p1 || before.p2 !== after.p2 || before.winner !== after.winner || before.status !== after.status) clearDownstream(db, after.id);
  },
  beforeDelete(db, m) {
    if (db.matches.some(x => [x.p1, x.p2].includes('winner:' + m.id))) throw new ApiError('This match feeds another round. Change the later match slots before deleting it.', 409);
  },
};

export const awards: CollectionSpec<Award> = {
  collection: 'awards', key: 'id', newId: () => 'award-' + randomUUID(),
  build: (b, _db, ex) => ({
    ...ex, id: ex?.id || '', sport: required(str(b.sport, 50), 'Sport'), category: required(str(b.category), 'Category'),
    team: team(b.team, false), place: required(str(b.place, 100), 'Placement'), points: num(b.points, 'Points'),
  }),
};

export const rules: CollectionSpec<Rule> = {
  collection: 'rules', key: 'place',
  build(b, db, ex) {
    const place = required(str(b.place, 100), 'Placement');
    if (db.rules.some(r => r.place === place && r !== ex)) throw new ApiError('A rule for this placement already exists.', 409);
    return { ...ex, place, points: num(b.points, 'Points') };
  },
};

type Item = Record<string, unknown>;
const list = (db: Tournament, c: Collection) => db[c] as unknown as Item[];

export function createItem<T>(spec: CollectionSpec<T>, body: Item) {
  return mutate(db => {
    const item = spec.build(body, db) as Item;
    if (spec.newId) item[spec.key] = spec.newId();
    list(db, spec.collection).push(item);
  });
}

export function updateItem<T>(spec: CollectionSpec<T>, id: string, body: Item) {
  return mutate(db => {
    const items = list(db, spec.collection);
    const i = items.findIndex(x => String(x[spec.key]) === id);
    if (i < 0) throw new ApiError('Not found.', 404);
    const before = items[i] as T;
    const after = spec.build(body, db, before) as Item;
    if (spec.newId) after[spec.key] = id;
    items[i] = after;
    spec.afterUpdate?.(db, before, after as T);
  });
}

export function deleteItem<T>(spec: CollectionSpec<T>, id: string) {
  return mutate(db => {
    const items = list(db, spec.collection);
    const item = items.find(x => String(x[spec.key]) === id);
    if (!item) throw new ApiError('Not found.', 404);
    spec.beforeDelete?.(db, item as T);
    (db as unknown as Record<string, Item[]>)[spec.collection] = list(db, spec.collection).filter(x => x !== item);
  });
}

export function validateTournament(x: unknown): Tournament {
  const d = x as Tournament;
  if (!d || COLLECTIONS.some(c => !Array.isArray(d[c]))) throw new ApiError('Invalid tournament backup: players, matches, awards and rules must be arrays.');
  return { players: d.players, matches: d.matches, awards: d.awards, rules: d.rules };
}

export const replaceAll = (data: Tournament, expectedRevision?: number) => mutate(db => { COLLECTIONS.forEach(c => { (db as unknown as Record<string, unknown>)[c] = data[c]; }); }, { allowEmpty: true, expectedRevision });
