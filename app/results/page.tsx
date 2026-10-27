'use client';
import { useState } from 'react';
import { CheerButton, Header, MatchFilters, SlotLink } from '@/components/ui';
import { useTournament } from '@/components/TournamentProvider';
import { defaultFilter, filterMatches, fmt, fmtTime, slotName } from '@/lib/tournament';

export default function Results() {
  const { db } = useTournament();
  const [f, setF] = useState({ ...defaultFilter, status: 'completed' });
  const ms = filterMatches(db, f).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <Header title="Results 🏆" sub="Find out who won each match." />
      <MatchFilters db={db} f={f} set={setF} />
      <div className="card">
        {ms.length ? ms.map(m => (
          <div className="resultrow" key={m.id}>
            <div className="mini">{fmt(m.date)} · {fmtTime(m.time)} · {m.sport} · {m.category} · {m.round}</div>
            <strong>{m.kind === 'event' ? 'Placings' : <><SlotLink id={m.p1} /> vs <SlotLink id={m.p2} /></>}</strong>
            <span className="tag green">{m.kind === 'event' ? '🥇' : 'Winner:'} {slotName(db, m.winner)}</span> <CheerButton who={slotName(db, m.winner)} />
            {m.second ? <span className="tag">🥈 {slotName(db, m.second)}</span> : null}
            {m.third ? <span className="tag">🥉 {slotName(db, m.third)}</span> : null}
            {' '}<span className="muted">{m.score}</span>
          </div>
        )) : <div className="empty">No results found. Try different filters!</div>}
      </div>
    </>
  );
}
