'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fmt, si } from '@/lib/tournament';
import { sheetAnchor } from '@/lib/sheet-anchor';
import s from './FixtureBrackets.module.css';

type Player = { id: string; name: string; team?: string };
type Match = {
  id: string; sport: string; category: string; round: string; roundOrder?: number;
  date?: string; time?: string; venue?: string; p1: string; p2: string;
  status: string; winner?: string; score?: string; sourceSheet?: number;
};
type Data = { players: Player[]; matches: Match[]; sports?: { id: string; name: string; icon: string }[] };
type Round = { name: string; order: number; matches: Match[] };

const teamCode = (t?: string) => (t === 'BI' ? 'WZ' : t ? 'HK' : '');
const matchNo = (id: string) => Number(id.match(/-m(\d+)$/)?.[1] ?? 0);

export default function FixtureBrackets({ sports }: { sports: string[] }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [sport, setSport] = useState(sports.includes('Badminton') ? 'Badminton' : sports[0]);
  const [category, setCategory] = useState('');
  const sportOptions = useMemo(() => [...new Set([...sports, ...(data?.sports?.map(s => s.name) || [])])], [data?.sports, sports]);
  useEffect(() => { if (sportOptions.length && !sportOptions.includes(sport)) setSport(sportOptions[0]); }, [sport, sportOptions]);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/tournament', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      setData((await r.json()).data);
      setError('');
    } catch {
      setError('Could not load the latest fixtures. Retrying…');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const players = useMemo(() => new Map((data?.players ?? []).map(p => [p.id, p])), [data]);
  const byId = useMemo(() => new Map((data?.matches ?? []).map(m => [m.id, m])), [data]);

  const resolve = useCallback((id: string, seen = new Set<string>()): string => {
    if (!id || id === 'BYE' || !id.startsWith('winner:')) return id || '';
    const mid = id.slice(7);
    if (seen.has(mid)) return '';
    seen.add(mid);
    const m = byId.get(mid);
    if (!m) return '';
    if (m.status === 'completed' && m.winner) return resolve(m.winner, seen);
    const a = resolve(m.p1, new Set(seen)), b = resolve(m.p2, new Set(seen));
    if (a === 'BYE') return b;
    if (b === 'BYE') return a;
    return id;
  }, [byId]);

  const categories = useMemo(() => {
    const list: string[] = [];
    for (const m of data?.matches ?? []) if (m.sport === sport && !list.includes(m.category)) list.push(m.category);
    return list;
  }, [data, sport]);
  const activeCategory = categories.includes(category) ? category : categories[0] ?? '';

  const rounds = useMemo<Round[]>(() => {
    const map = new Map<string, Round>();
    for (const m of data?.matches ?? []) {
      if (m.sport !== sport || m.category !== activeCategory) continue;
      const r = map.get(m.round) ?? { name: m.round, order: m.roundOrder ?? 1, matches: [] };
      r.matches.push(m);
      map.set(m.round, r);
    }
    const list = [...map.values()].sort((a, b) => a.order - b.order);
    list.forEach(r => r.matches.sort((a, b) => matchNo(a.id) - matchNo(b.id)));
    return list;
  }, [data, sport, activeCategory]);

  const stats = useMemo(() => {
    const ms = rounds.flatMap(r => r.matches).filter(m => m.status !== 'bye');
    const done = ms.filter(m => m.status === 'completed').length;
    const next = ms.filter(m => m.status === 'scheduled' && m.date).map(m => m.date!).sort()[0];
    return { total: ms.length, done, next };
  }, [rounds]);

  const final = rounds.at(-1)?.matches.length === 1 ? rounds.at(-1)!.matches[0] : undefined;
  const champion = final?.status === 'completed' && final.winner ? players.get(resolve(final.winner)) : undefined;
  const sheetNo = rounds[0]?.matches[0]?.sourceSheet;

  const openSheet = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    for (let d = el.closest('details'); d; d = d.parentElement?.closest('details') ?? null) d.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const Side = ({ id, match }: { id: string; match: Match }) => {
    const r = resolve(id);
    const p = players.get(r);
    const won = match.status === 'completed' && !!match.winner && resolve(match.winner) === r && !!p;
    const lost = match.status === 'completed' && !!match.winner && !won && !!p;
    const advances = match.status === 'bye' && !!p;
    if (r === 'BYE') return <div className={`${s.side} ${s.bye}`}>BYE</div>;
    if (!p) {
      const src = r.startsWith('winner:') ? byId.get(r.slice(7)) : undefined;
      return <div className={`${s.side} ${s.pending}`}>{src ? `Winner of ${src.round} · M${matchNo(src.id)}` : 'TBD'}</div>;
    }
    const code = teamCode(p.team);
    return (
      <div className={`${s.side} ${won || advances ? s.won : ''} ${lost ? s.lost : ''}`}>
        <Link href={`/players/${p.id}`} className={s.name}>{p.name}</Link>
        {code && <span className={`${s.team} ${code === 'WZ' ? s.wz : s.hk}`}>{code}</span>}
        {won && <span className={s.tick} aria-label="Winner">✓</span>}
      </div>
    );
  };

  const Card = ({ m }: { m: Match }) => (
    <div className={`${s.match} ${m.status === 'completed' ? s.done : ''} ${m.status === 'bye' ? s.isBye : ''}`}>
      <div className={s.mhead}>
        <span>M{matchNo(m.id)}</span>
        <span>{m.status === 'completed' ? 'Done' : m.status === 'bye' ? 'Advances' : `${fmt(m.date || '').replace(/ \d{4}$/, '')}${m.time ? ' · ' + m.time : ''}`}</span>
      </div>
      <Side id={m.p1} match={m} />
      <Side id={m.p2} match={m} />
      {(m.score || m.venue) && <div className={s.foot}>{[m.score, m.venue].filter(Boolean).join(' · ')}</div>}
    </div>
  );

  return (
    <div className={s.wrap}>
      <div className={s.sports} role="tablist" aria-label="Sport">
        {sportOptions.map(x => (
          <button key={x} role="tab" aria-selected={x === sport} className={`${s.pill} ${x === sport ? s.active : ''}`} onClick={() => { setSport(x); setCategory(''); }}>
            {si(x, data || undefined)}{x}
          </button>
        ))}
      </div>

      {error && <div className="notice" role="alert">{error}</div>}
      {!data && !error && <div className="card">Loading fixtures…</div>}

      {data && (categories.length === 0 ? <div className="card">No fixtures for {sport} yet.</div> : (
        <div className={`card ${s.board}`}>
          <div className={s.cats} role="tablist" aria-label="Category">
            {categories.map(c => (
              <button key={c} role="tab" aria-selected={c === activeCategory} className={`${s.cat} ${c === activeCategory ? s.active : ''}`} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>

          <div className={s.title}>
            <h3>{si(sport, data || undefined)}{sport} · {activeCategory}</h3>
            <div className={s.chips}>
              <span className={s.chip}>{stats.total} matches</span>
              <span className={s.chip}>{stats.done} played</span>
              {stats.next && <span className={s.chip}>Next: {fmt(stats.next)}</span>}
              {sheetNo && <a className={s.sheetlink} href={`#${sheetAnchor(sport, sheetNo)}`} onClick={e => openSheet(e, sheetAnchor(sport, sheetNo))}>Original sheet ↓</a>}
            </div>
          </div>

          <div className={s.bracket}>
            {rounds.map((r, i) => {
              const next = rounds[i + 1];
              const mode = !next ? 'straight' : next.matches.length * 2 === r.matches.length ? 'pair' : next.matches.length === r.matches.length ? 'straight' : 'none';
              const dates = [...new Set(r.matches.map(m => m.date).filter(Boolean))].sort();
              return (
                <div className={s.col} key={r.name}>
                  <div className={s.colhead}><b>{r.name}</b><span>{dates.length ? fmt(dates[0] || '').replace(/ \d{4}$/, '') + (dates.length > 1 ? ' – ' + fmt(dates.at(-1) || '').replace(/ \d{4}$/, '') : '') : 'Date TBD'}</span></div>
                  <div className={`${s.colbody} ${s[mode]}`}>
                    {mode === 'pair'
                      ? Array.from({ length: r.matches.length / 2 }, (_, k) => (
                        <div className={s.pairbox} key={k}>
                          {r.matches.slice(k * 2, k * 2 + 2).map(m => <div className={s.slot} key={m.id}><Card m={m} /></div>)}
                        </div>
                      ))
                      : r.matches.map(m => <div className={s.slot} key={m.id}><Card m={m} /></div>)}
                  </div>
                </div>
              );
            })}
            {final && (
              <div className={`${s.col} ${s.championCol}`}>
                <div className={s.colhead}><b>Champion</b><span>{fmt(final.date || '').replace(/ \d{4}$/, '')}</span></div>
                <div className={s.colbody}>
                  <div className={s.slot}>
                    <div className={`${s.champion} ${champion ? s.crowned : ''}`}>
                      <span className={s.trophy}>🏆</span>
                      {champion ? <Link href={`/players/${champion.id}`}>{champion.name}</Link> : <span>To be decided</span>}
                      {champion?.team && <span className={`${s.team} ${teamCode(champion.team) === 'WZ' ? s.wz : s.hk}`}>{teamCode(champion.team)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className={s.hint}>Swipe sideways to follow every round →</p>
        </div>
      ))}
    </div>
  );
}
