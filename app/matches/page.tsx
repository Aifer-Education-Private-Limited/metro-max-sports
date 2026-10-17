'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Header, MatchFilters, SlotLink, tagClass } from '@/components/ui';
import { useTournament } from '@/components/TournamentProvider';
import { defaultFilter, filterMatches, fmt, si, statusLabel } from '@/lib/tournament';

export default function Matches() {
  const { db } = useTournament();
  const [f, setF] = useState(defaultFilter);
  const ms = filterMatches(db, f);
  return (
    <>
      <div className="notice">The uploaded Season XVI brackets are available under <Link className="textlink" href="/official">Official Fixtures →</Link>. The individual match listing below is the live tournament data.</div>
      <Header title="All Matches 📅" sub="Tap a player's name to see all their games." />
      <MatchFilters db={db} f={f} set={setF} />
      <div className="tablewrap">
        <table className="stack-m">
          <thead><tr><th>When</th><th>Sport</th><th>Match</th><th>Round</th><th>Status</th><th>Winner</th></tr></thead>
          <tbody>
            {ms.length ? ms.map(m => (
              <tr key={m.id}>
                <td data-label="When"><b>{fmt(m.date)}</b><div className="mini">{m.time || 'Time TBD'}</div></td>
                <td data-label="Sport"><b>{si(m.sport)}{m.sport}</b><div className="mini">{m.category}</div></td>
                <td data-label="Match"><SlotLink id={m.p1} /> <span className="muted">vs</span> <SlotLink id={m.p2} /></td>
                <td data-label="Round">{m.round}</td>
                <td data-label="Status"><span className={tagClass(m.status)}>{statusLabel(m.status)}</span></td>
                <td data-label="Winner">{m.winner ? <SlotLink id={m.winner} /> : '—'}</td>
              </tr>
            )) : <tr><td colSpan={6} className="empty">No matches found. Try a different search!</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
