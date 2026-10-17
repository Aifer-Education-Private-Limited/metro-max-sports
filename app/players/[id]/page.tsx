'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FixtureCard, Header, SlotLink } from '@/components/ui';
import { useTournament } from '@/components/TournamentProvider';
import { fmt, playsIn, teamName } from '@/lib/tournament';

export default function Profile() {
  const { db, ready } = useTournament();
  const id = decodeURIComponent(useParams<{ id: string }>().id);
  const p = db.players.find(x => x.id === id);
  const back = <Link className="btn secondary" href="/players">← All Players</Link>;
  if (!p) return <><Header title="Player Profile" sub={ready ? 'This player could not be found.' : 'Loading…'} action={back} /></>;
  const ms = db.matches.filter(m => playsIn(db, m, p.id));
  const completed = ms.filter(m => m.status === 'completed').sort((a, b) => b.date.localeCompare(a.date));
  const wins = completed.filter(m => m.winner === p.id);
  const upcoming = ms.filter(m => m.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <Header title="Player Profile" sub="All the games and wins for this player." action={back} />
      <div className="profile">
        <div className="card profilecard">
          <div className="avatar">{p.name.split(' ').map(x => x[0]).slice(0, 2).join('')}</div>
          <h2>{p.name}</h2>
          <span className="chip">{p.team === 'BI' ? '🔵' : '🦁'} {teamName(p.team)}</span>
          {p.flat && <span className="chip">🏠 {p.flat}</span>}
          <span className="chip">{ms.length} matches</span>
          <span className="chip">🏆 {wins.length} wins</span>
        </div>
        <div className="stack">
          <div className="card">
            <div className="sectionhead"><h3>⏰ Coming Up</h3></div>
            {upcoming.length ? upcoming.map(m => <FixtureCard key={m.id} m={m} />) : <div className="empty">No pending fixtures</div>}
          </div>
          <div className="card">
            <div className="sectionhead"><h3>🏆 Match Results</h3></div>
            {completed.length ? completed.map(m => (
              <div className="resultrow" key={m.id}>
                <div className="mini">{m.sport} · {m.category} · {fmt(m.date)}</div>
                <strong><SlotLink id={m.p1} /> vs <SlotLink id={m.p2} /></strong>
                <span className={'tag ' + (m.winner === p.id ? 'green' : 'gold')}>{m.winner === p.id ? '🏆 Won' : 'Good game! 👏'}</span> {m.score}
              </div>
            )) : <div className="empty">No finished matches yet</div>}
          </div>
        </div>
      </div>
    </>
  );
}
