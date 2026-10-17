'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { CheerButton, FixtureCard, Header, SlotLink } from '@/components/ui';
import { useTournament } from '@/components/TournamentProvider';
import { fmt, points, si, slotName, sports } from '@/lib/tournament';

export default function Home() {
  const { db } = useTournament();
  const recent = db.matches.filter(m => m.status === 'completed').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const total = db.matches.filter(m => m.status !== 'bye').length, done = db.matches.filter(m => m.status === 'completed').length;
  const up = db.matches.filter(m => m.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const bi = points(db, 'BI'), gl = points(db, 'GL');
  return (
    <>
      <Header title="Welcome to SportsFest! 🎉" sub="See who is playing, when, and who won." action={<Link className="btn" href="/official">Official Fixtures →</Link>} />
      <div className="hero">
        <div>
          <div className="eyebrow">★ Metromax Sports Season XVI</div>
          <h2>Where every match<br />makes a memory.</h2>
          <p>18 October – 8 November 2026 · Fixtures, match results, player journeys and team pride — all in one place.</p>
        </div>
        <div className="vs">
          <div className="teamcrest"><img className="official-logo" src="/brand/mmx-wizardz.webp" alt="MMX Wizardz logo" /><b>MMX WIZARDZ</b></div>
          <div className="vslabel">VS</div>
          <div className="teamcrest"><img className="official-logo" src="/brand/metro-hawks.webp" alt="Metro Hawks logo" /><b>METRO HAWKS</b></div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 20 }}>
        <div className="sectionhead"><h3>Season XVI · Official fixtures</h3><Link className="btn" href="/official">View fixtures &amp; brackets →</Link></div>
        <p className="muted">Live, editable brackets across Badminton, Table Tennis, Carroms and Chess, with the full season calendar.</p>
      </div>
      <div className="fun-banner">
        <div><h3>🎉 Every player deserves a cheer!</h3><p>Celebrate your community champions and explore their match journeys.</p></div>
        <CheerButton who="SportsFest" label="🎊 Let's celebrate!" />
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="sectionhead"><h3>🌟 Champion cheers</h3><Link className="textlink" href="/results">All results →</Link></div>
        {recent.length ? recent.map(m => (
          <div className="winner-tile" key={m.id}>
            <div><span className="mini">{si(m.sport)}{m.sport} · {m.category}</span><strong><SlotLink id={m.winner} /> won!</strong><span className="mini">{m.score || m.round}</span></div>
            <CheerButton who={slotName(db, m.winner)} />
          </div>
        )) : <p className="muted" style={{ fontSize: 13 }}>The celebration wall will light up when the first results are recorded.</p>}
      </div>
      <div className="homepoints">
        <div className="card">
          <div className="sectionhead"><h3>🏆 Overall Points Standings</h3><Link className="textlink" href="/points">Points details →</Link></div>
          <div className="scoreboard">
            <div className="scoreteam"><img className="standing-logo" src="/brand/mmx-wizardz.webp" alt="MMX Wizardz logo" width={76} height={76} /><div className="big">{bi}<small className="pts-label">pts</small></div><div className="name">MMX WIZARDZ</div></div>
            <b className="muted">VS</b>
            <div className="scoreteam"><img className="standing-logo" src="/brand/metro-hawks.webp" alt="Metro Hawks logo" width={76} height={76} /><div className="big">{gl}<small className="pts-label">pts</small></div><div className="name">METRO HAWKS</div></div>
          </div>
          <div className="progress"><span style={{ width: `${bi + gl ? (100 * bi) / (bi + gl) : 50}%` }} /><span style={{ flex: 1 }} /></div>
          <div className="scorecaption">Points update as winners are confirmed · Tap “Points details” to see every sport</div>
        </div>
      </div>
      <HappyPromo />
      <div className="stats">
        {([['🙂 Participants / pairs', db.players.length, 'Across both teams'], ['📅 Matches', total, `In ${sports.length} sports`], ['✅ Matches Done', done, 'Results recorded'], ['⏰ Still to Play', total - done, 'Coming up soon']] as const).map(([l, n, f]) => (
          <div className="card stat" key={l}><div className="label">{l}</div><div className="number">{n}</div><div className="foot">{f}</div></div>
        ))}
      </div>
      <div className="columns">
        <div className="card">
          <div className="sectionhead"><h3>📅 Coming Up Next</h3><Link className="textlink" href="/matches">View all →</Link></div>
          {up.length ? up.map(m => <FixtureCard key={m.id} m={m} />) : <div className="empty">No matches coming up right now</div>}
        </div>
        <div className="stack">
          <div className="card">
            <div className="sectionhead"><h3>✅ Latest Results</h3><Link className="textlink" href="/results">All results →</Link></div>
            {recent.length ? recent.map(m => (
              <div className="resultrow" key={m.id}><div className="mini">{si(m.sport)}{m.sport} · {fmt(m.date)}</div><strong><SlotLink id={m.p1} /> vs <SlotLink id={m.p2} /></strong><span className="tag green">{slotName(db, m.winner)} won</span></div>
            )) : <div className="empty">No results yet. Check back soon! 🌟</div>}
          </div>
        </div>
      </div>
      <div className="card tk-card">
        <img className="tk-logo" src="/brand/teekops.png" alt="TeekOps — Tech Done Right." width={150} height={103} />
        <div className="tk-body">
          <div className="tk-eyebrow">Built by TeekOps</div>
          <p>We build custom software, web &amp; mobile apps, ERP/CRM systems and AI automation for growing businesses. If your business could use a tech partner, we’d love to hear from you.</p>
          <div className="tk-actions"><a className="btn tk-btn" href="https://www.teekops.com/contact" target="_blank" rel="noopener">Get a Free Tech Audit →</a><a className="btn secondary tk-btn" href="https://www.teekops.com/" target="_blank" rel="noopener">Visit teekops.com</a></div>
        </div>
      </div>
    </>
  );
}

function HappyPromo() {
  return (
    <section className="happy-promo" aria-label="Happy School promotion">
      <div>
        <img className="happy-brand-logo" src="/brand/happy-school.webp" alt="Happy School by Aifer" width={256} height={98} />
        <h3 className="happy-malayalam" lang="ml">ഇനി സ്കൂളിൽ പഠിക്കാത്തത് ഹാപ്പി സ്കൂളിൽ പഠിക്കാം</h3>
        <p>One-to-one online tuition for Grades 1–12. Personalized learning for CBSE, ICSE and Kerala State Board students.</p>
        <div className="happy-tags"><span>1:1 attention</span><span>Live classes</span><span>Learn at your pace</span></div>
      </div>
      <a className="happy-cta" href="https://happyschool.app/" target="_blank" rel="noopener">Explore Happy School ↗</a>
    </section>
  );
}
