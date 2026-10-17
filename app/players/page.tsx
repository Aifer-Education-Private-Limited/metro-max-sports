'use client';
import { useState } from 'react';
import { Header, SlotLink } from '@/components/ui';
import { useTournament } from '@/components/TournamentProvider';
import { playsIn, teamName } from '@/lib/tournament';

export default function Players() {
  const { db } = useTournament();
  const [q, setQ] = useState('');
  const ps = db.players.filter(p => [p.name, p.flat, p.team, teamName(p.team)].join(' ').toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <Header title="Players 🙂" sub="Find a player and see their games and wins." />
      <div className="toolbar"><input className="input" placeholder="🔍 Search by name, flat or team" value={q} onChange={e => setQ(e.target.value)} aria-label="Search players" /></div>
      <div className="tablewrap">
        <table className="stack-m">
          <thead><tr><th>Player</th><th>Flat</th><th>Team</th><th>Matches</th><th>Finished</th></tr></thead>
          <tbody>
            {ps.length ? ps.map(p => {
              const ms = db.matches.filter(m => playsIn(db, m, p.id));
              return (
                <tr key={p.id}>
                  <td data-label="Player"><SlotLink id={p.id} /></td>
                  <td data-label="Flat">{p.flat || '—'}</td>
                  <td data-label="Team">{teamName(p.team)}</td>
                  <td data-label="Matches">{ms.length}</td>
                  <td data-label="Finished">{ms.filter(m => m.status === 'completed').length}</td>
                </tr>
              );
            }) : <tr><td colSpan={5} className="empty">No players found. Try a different name!</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
