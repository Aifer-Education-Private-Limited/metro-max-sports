import 'server-only';
import { randomUUID } from 'crypto';
import seed from '@/data/seed.json';
import { clearDownstream, defaultSports } from './tournament';
import { getStore } from './store';
import { ConflictError } from './store/types';
import { COLLECTIONS, type Award, type Collection, type Match, type MatchStatus, type Player, type Rule, type Sport, type Team, type Tournament, type TournamentSnapshot } from './types';

export class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const normalize = (data: Tournament): Tournament => {
  if (!Array.isArray(data.sports) || !data.sports.length) {
    const used = new Set([...data.matches.map(m => m.sport), ...data.awards.map(a => a.sport)]);
    data.sports = structuredClone(defaultSports);
    for (const name of used) if (name && !data.sports.some(s => s.name === name)) data.sports.push({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, icon: '🏅' });
  }
  data.matches = (data.matches || []).map(m => ({
    ...m,
    completedAt: m.status === 'completed' ? str(m.completedAt, 40) || (m.date ? `${m.date}T${m.time || '00:00'}:00` : '') : '',
  }));
  data.rules = (data.rules || []).map(r => {
    const sport = str(r.sport, 50);
    const place = str(r.place, 100);
    return { ...r, sport, place, points: Number(r.points || 0), id: str(r.id, 200) || `${sport || 'all'}::${place}` };
  });
  return data;
};
export const seedData = () => normalize(structuredClone(seed) as Tournament);
const isEmpty = (d: Tournament) => ['players', 'matches', 'awards', 'rules'].every(c => !(d[c as Exclude<Collection, 'sports'>] as unknown[]).length);

let cache: { snap: TournamentSnapshot; at: number } | null = null;
const CACHE_MS = Number(process.env.READ_CACHE_MS ?? 3000);

export async function getSnapshot(fresh = false): Promise<TournamentSnapshot> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.snap;
  const loaded = await getStore().load();
  const data = normalize(loaded.data), revision = loaded.revision;
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
      const loaded = await getStore().load();
      const data = normalize(loaded.data), revision = loaded.revision;
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

export const sports: CollectionSpec<Sport> = {
  collection: 'sports', key: 'id', newId: () => 'sport-' + randomUUID(),
  build(b, db, ex) {
    const name = required(str(b.name, 50), 'Sport name');
    if (db.sports.some(s => s.name.toLowerCase() === name.toLowerCase() && s.id !== ex?.id)) throw new ApiError('A sport with this name already exists.', 409);
    return { ...ex, id: ex?.id || '', name, icon: str(b.icon, 12) || '🏅' };
  },
  afterUpdate(db, before, after) {
    if (before.name === after.name) return;
    db.matches.forEach(m => { if (m.sport === before.name) m.sport = after.name; });
    db.awards.forEach(a => { if (a.sport === before.name) a.sport = after.name; });
    db.rules.forEach(r => { if (r.sport === before.name) { r.sport = after.name; r.id = `${after.name}::${r.place}`; } });
  },
  beforeDelete(db, sport) {
    const uses = db.matches.filter(m => m.sport === sport.name).length + db.awards.filter(a => a.sport === sport.name).length + db.rules.filter(r => r.sport === sport.name).length;
    if (uses) throw new ApiError(`This sport is used by ${uses} match, points or rule record(s). Remove those records before deleting it.`, 409);
  },
};

export const players: CollectionSpec<Player> = {
  collection: 'players', key: 'id', newId: () => 'participant-' + randomUUID(),
  build: (b, _db, ex) => ({ ...ex, id: ex?.id || '', name: required(str(b.name), 'Name'), flat: str(b.flat, 50), team: team(b.team) }),
  beforeDelete(db, p) {
    for (const m of db.matches) {
      if (![m.p1, m.p2, m.winner, m.second, m.third].includes(p.id)) continue;
      if (m.p1 === p.id) m.p1 = '';
      if (m.p2 === p.id) m.p2 = '';
      if (m.winner === p.id) { m.winner = ''; m.score = ''; }
      if (m.second === p.id) m.second = '';
      if (m.third === p.id) m.third = '';
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
    const kind = str(b.kind) === 'event' ? 'event' : 'match';
    const status = str(b.status) as MatchStatus;
    if (!['scheduled', 'completed', 'bye'].includes(status)) throw new ApiError('Status must be scheduled, completed or bye.');
    if (kind === 'event' && status === 'bye') throw new ApiError('A placings event cannot be a bye.');
    const p1 = kind === 'event' ? '' : slot(b.p1), p2 = kind === 'event' ? '' : slot(b.p2);
    if (p1 && p1 === p2 && p1 !== 'BYE') throw new ApiError('Choose two different participants.');
    const placement = (v: unknown, label: string) => {
      const s = str(v, 300);
      if (!s) return '';
      if (s === 'BYE' || s.startsWith('winner:') || !db.players.some(p => p.id === s)) throw new ApiError(`${label} must be a participant.`);
      return s;
    };
    let winner = '', second = '', third = '';
    if (status === 'bye') winner = p1 === 'BYE' ? p2 : p1;
    else if (status === 'completed') {
      if (kind === 'event') {
        winner = required(placement(b.winner, '1st place'), '1st place');
        second = placement(b.second, '2nd place');
        third = placement(b.third, '3rd place');
        const placed = [winner, second, third].filter(Boolean);
        if (new Set(placed).size !== placed.length) throw new ApiError('Choose different participants for each placing.');
      } else {
        winner = str(b.winner, 300);
        if (!winner) throw new ApiError('Choose a winner before completing this match.');
      }
    }
    if (status === 'bye' && ![p1, p2].includes('BYE')) throw new ApiError('A bye requires one BYE slot.');
    const date = str(b.date, 10), time = str(b.time, 5);
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError('Date must be YYYY-MM-DD.');
    if (time && !/^\d{2}:\d{2}$/.test(time)) throw new ApiError('Time must be HH:mm.');
    const sport = required(str(b.sport, 50), 'Sport');
    if (!db.sports.some(s => s.name === sport)) throw new ApiError('Choose a sport configured in Admin.');
    return {
      ...ex, id: ex?.id || '', sport, category: required(str(b.category), 'Category'),
      round: required(str(b.round, 100), 'Round'), roundOrder: num(b.roundOrder ?? 1, 'Round order', 1, 20), date, time,
      venue: str(b.venue, 200), p1, p2, status, winner, second, third, kind, score: str(b.score, 500), sourceSheet: ex?.sourceSheet ?? '',
      completedAt: status === 'completed' ? str(ex?.completedAt, 40) || new Date().toISOString() : '',
    };
  },
  afterUpdate(db, before, after) {
    if (before.p1 !== after.p1 || before.p2 !== after.p2 || before.winner !== after.winner || before.second !== after.second || before.third !== after.third || before.status !== after.status) clearDownstream(db, after.id);
  },
  beforeDelete(db, m) {
    if (db.matches.some(x => [x.p1, x.p2].includes('winner:' + m.id))) throw new ApiError('This match feeds another round. Change the later match slots before deleting it.', 409);
  },
};

export const awards: CollectionSpec<Award> = {
  collection: 'awards', key: 'id', newId: () => 'award-' + randomUUID(),
  build(b, db, ex) {
    const sport = required(str(b.sport, 50), 'Sport');
    if (!db.sports.some(s => s.name === sport)) throw new ApiError('Choose a sport configured in Admin.');
    return {
      ...ex, id: ex?.id || '', sport, category: required(str(b.category), 'Category'),
      team: team(b.team, false), place: required(str(b.place, 100), 'Placement'), points: num(b.points, 'Points'),
    };
  },
};

export const rules: CollectionSpec<Rule> = {
  collection: 'rules', key: 'id',
  build(b, db, ex) {
    const sport = str(b.sport, 50);
    if (sport && !db.sports.some(s => s.name === sport)) throw new ApiError('Choose a sport configured in Admin.');
    const place = required(str(b.place, 100), 'Placement');
    if (db.rules.some(r => r.sport === sport && r.place.toLowerCase() === place.toLowerCase() && r !== ex)) throw new ApiError('A rule for this sport and placement already exists.', 409);
    return { ...ex, id: `${sport || 'all'}::${place}`, sport, place, points: num(b.points, 'Points') };
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
  if (!d || ['players', 'matches', 'awards', 'rules'].some(c => !Array.isArray(d[c as Exclude<Collection, 'sports'>]))) throw new ApiError('Invalid tournament backup: players, matches, awards and rules must be arrays.');
  return normalize({ players: d.players, matches: d.matches, awards: d.awards, rules: d.rules, sports: Array.isArray(d.sports) ? d.sports : [] });
}

export const replaceAll = (data: Tournament, expectedRevision?: number) => mutate(db => { COLLECTIONS.forEach(c => { (db as unknown as Record<string, unknown>)[c] = data[c]; }); }, { allowEmpty: true, expectedRevision });
