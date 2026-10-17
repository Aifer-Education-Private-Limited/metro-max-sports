'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useState } from 'react';
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
          <div className="sectionhead"><h3>🏆 Overall Points Standings</h3><div className="score-actions"><ShareStandings wizardz={bi} hawks={gl} /><Link className="textlink" href="/points">Points details →</Link></div></div>
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
      <div className="happy-actions">
        <a className="happy-whatsapp" href="https://wa.me/919356100300?text=Hi%20Happy%20School%20team%2C%20I%20am%20from%20Metro%20Max%20and%20would%20like%20to%20know%20more%20about%20your%20classes%20and%20admission%20details." target="_blank" rel="noopener" aria-label="Contact Happy School on WhatsApp">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3A12.9 12.9 0 0 0 5.12 22.77L3.4 29l6.38-1.67A12.98 12.98 0 1 0 16.04 3Zm0 23.77c-1.92 0-3.8-.52-5.44-1.5l-.39-.23-3.79.99 1.01-3.69-.25-.38a10.73 10.73 0 1 1 8.86 4.81Zm5.89-8.04c-.32-.16-1.91-.94-2.21-1.05-.29-.11-.51-.16-.72.16-.22.32-.84 1.05-1.03 1.27-.19.21-.38.24-.7.08-.33-.16-1.37-.5-2.61-1.61a9.77 9.77 0 0 1-1.81-2.25c-.19-.32-.02-.5.14-.66.15-.14.33-.38.49-.57.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.99-2.37-.26-.63-.53-.55-.72-.56h-.62c-.22 0-.57.08-.87.4-.29.33-1.13 1.11-1.13 2.7s1.16 3.13 1.32 3.34c.16.22 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.78.24 1.48.21 2.04.13.62-.09 1.91-.78 2.18-1.54.27-.75.27-1.4.19-1.54-.08-.13-.3-.21-.62-.37Z" /></svg>
          WhatsApp us
        </a>
        <a className="happy-cta" href="https://happyschool.app/" target="_blank" rel="noopener">Explore Happy School ↗</a>
      </div>
    </section>
  );
}

function ShareStandings({ wizardz, hawks }: { wizardz: number; hawks: number }) {
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function shareCard() {
    setSharing(true);
    try {
      const sources = ['/brand/mmx-wizardz.webp', '/brand/metro-hawks.webp', '/brand/happy-school.webp', '/brand/teekops.png'];
      const images = await Promise.all(sources.map(src => new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      })));
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const [wizardzLogo, hawksLogo, happyLogo, teekopsLogo] = images;
      const fit = (image: HTMLImageElement, x: number, y: number, width: number, height: number) => {
        const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
      };
      ctx.fillStyle = '#f5faf6';
      ctx.fillRect(0, 0, 1080, 1080);
      ctx.fillStyle = '#123b3e';
      ctx.fillRect(0, 0, 1080, 170);
      ctx.fillStyle = '#f8b847';
      ctx.font = '800 27px Arial';
      ctx.fillText('★  METROMAX SPORTSFEST', 70, 75);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 42px Arial';
      ctx.fillText('OVERALL POINTS STANDINGS', 70, 130);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(55, 210, 970, 520, 34);
      ctx.fill();
      fit(wizardzLogo, 150, 270, 190, 190);
      fit(hawksLogo, 740, 270, 190, 190);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#24313b';
      ctx.font = '800 105px Arial';
      ctx.fillText(String(wizardz), 245, 575);
      ctx.fillText(String(hawks), 835, 575);
      ctx.font = '700 22px Arial';
      ctx.fillText('MMX WIZARDZ', 245, 635);
      ctx.fillText('METRO HAWKS', 835, 635);
      ctx.fillStyle = '#657a80';
      ctx.font = '700 24px Arial';
      ctx.fillText('VS', 540, 480);
      ctx.fillStyle = '#087f83';
      ctx.fillRect(95, 680, 445, 12);
      ctx.fillStyle = '#f3b63f';
      ctx.fillRect(540, 680, 445, 12);
      ctx.fillStyle = '#fff6df';
      ctx.beginPath();
      ctx.roundRect(55, 770, 970, 245, 28);
      ctx.fill();
      ctx.textAlign = 'left';
      fit(happyLogo, 90, 805, 330, 110);
      ctx.fillStyle = '#335657';
      ctx.font = '600 21px Arial';
      ctx.fillText('Personalized 1:1 learning for Grades 1–12', 92, 955);
      fit(teekopsLogo, 710, 810, 240, 125);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#335657';
      ctx.font = '700 18px Arial';
      ctx.fillText('Website by TeekOps · Tech Done Right.', 830, 970);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return;
      const file = new File([blob], 'metromax-sportsfest-standings.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Metromax SportsFest standings', text: `MMX Wizardz ${wizardz} – ${hawks} Metro Hawks`, files: [file] });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <button className="share-score-btn" type="button" onClick={() => setOpen(true)}>Share score</button>
      {open && <div className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={() => setOpen(false)}>
        <div className="share-dialog" onClick={event => event.stopPropagation()}>
          <button className="share-close" type="button" aria-label="Close share preview" onClick={() => setOpen(false)}>×</button>
          <div className="share-preview">
            <div className="share-brand"><span>★ METROMAX SPORTSFEST</span><strong id="share-title">Overall Points Standings</strong></div>
            <div className="share-teams">
              <div><img src="/brand/mmx-wizardz.webp" alt="MMX Wizardz" /><b>{wizardz}</b><span>MMX WIZARDZ</span></div>
              <strong className="share-vs">VS</strong>
              <div><img src="/brand/metro-hawks.webp" alt="Metro Hawks" /><b>{hawks}</b><span>METRO HAWKS</span></div>
            </div>
            <div className="share-sponsors">
              <div><img src="/brand/happy-school.webp" alt="Happy School by Aifer" /><span>Personalized 1:1 learning</span></div>
              <div><img src="/brand/teekops.png" alt="TeekOps" /><span>Tech Done Right.</span></div>
            </div>
          </div>
          <p className="share-help">Share a polished image to WhatsApp, Instagram, or any supported app.</p>
          <button className="btn share-now" type="button" disabled={sharing} onClick={shareCard}>{sharing ? 'Preparing image…' : 'Share standings image'}</button>
        </div>
      </div>}
    </>
  );
}
