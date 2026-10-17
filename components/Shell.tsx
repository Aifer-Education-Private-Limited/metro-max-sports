'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTournament } from './TournamentProvider';

export const nav: [string, string, string][] = [
  ['/', '🏠', 'Home'], ['/matches', '📅', 'Matches'], ['/official', '🗓️', 'Fixtures'], ['/sports', '🏸', 'Sports'],
  ['/players', '🙂', 'Players'], ['/results', '🏆', 'Results'], ['/points', '⭐', 'Points'], ['/admin', '⚙️', 'Admin'],
];
const more = nav.map(([href]) => href).filter(href => href !== '/');

const active = (path: string, href: string) => (href === '/' ? path === '/' : path === href || (href === '/players' && path.startsWith('/players/')));

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { ready, error, refresh } = useTournament();
  const current = nav.find(([h]) => path === h)?.[2] || (path.startsWith('/players/') ? 'Player Profile' : 'Home');
  return (
    <>
      {!ready && !error && (
        <div id="brand-loader" role="status" aria-label="Loading Metromax SportsFest">
          <div className="loader-inner">
            <div className="loader-logo-panel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="happy-brand-logo" src="/brand/happy-school.webp" alt="Happy School by Aifer" width={256} height={98} />
            </div>
            <h2 className="happy-malayalam" lang="ml">ഇനി സ്കൂളിൽ പഠിക്കാത്തത് ഹാപ്പി സ്കൂളിൽ പഠിക്കാം</h2>
            <p>Getting your tournament ready…</p>
            <div className="loader-track" aria-hidden="true" />
          </div>
        </div>
      )}
      <a className="skip-link" href="#app">Skip to tournament content</a>
      <div className="app">
        <aside className="sidebar">
          <div className="brand"><div className="brandmark">★</div><span><b>SPORTSFEST</b><small>METROMAX COMMUNITY</small></span></div>
          <div className="nav">
            {nav.map(([href, ico, label]) => (
              <Link key={href} href={href} className={active(path, href) ? 'active' : ''} data-nav={href} aria-current={active(path, href) ? 'page' : undefined}>
                <span className="ico">{ico}</span><span className="navtext">{label}</span>
              </Link>
            ))}
            <details className="mobile-more">
              <summary className={more.some(h => active(path, h)) ? 'active' : ''} aria-label="More navigation"><span className="ico">☰</span><span className="navtext">More</span></summary>
              <div className="more-panel">
                {nav.filter(([h]) => more.includes(h)).map(([href, ico, label]) => (
                  <Link key={href} href={href} className={active(path, href) ? 'active' : ''}><span>{ico}</span>{label}</Link>
                ))}
              </div>
            </details>
          </div>
        </aside>
        <main className="main" id="app">
          <div className="topbar">
            <div className="crumb">METROMAX / <strong>{current}</strong></div>
            <div className="top-actions"><span className="pill live"><span className="dot" /> Tournament Hub</span><span className="pill">★ SportsFest</span></div>
          </div>
          <div className="content">
            {error && <div className="notice">{error} <button className="textlink" onClick={() => refresh(true)}>Retry</button></div>}
            {children}
            <div className="credit-bar" role="note">
              <a className="credit-link" href="https://www.teekops.com/" target="_blank" rel="noopener" aria-label="Website by TeekOps — Tech Done Right. Opens teekops.com in a new tab">
                <svg className="tk-icon" viewBox="0 0 322 178" fill="none" aria-hidden="true" focusable="false"><path d="M76.76 174.44V142.89c0-6.02-2.170-11.84-6.12-16.39L38.46 89.45c-.37-.42-.37-1.05 0-1.47L70.64 50.93c3.95-4.55 6.12-10.37 6.12-16.39V2.99c0-1.03-1.28-1.51-1.96-.73L.35 87.98c-.37.42-.37 1.05 0 1.47L74.8 175.18c.68.78 1.96.3 1.96-.73z" fill="#fff" /><path d="M321.72 88.71l-76.83 88.47v-34.54c0-6.020 2.17-11.84 6.12-16.39l32.59-37.53-26.02-29.96 19.06-21.94 45.07 51.9z" fill="#00bfa5" /><path d="M225.72 28.58l6.84-7.88C244.19 7.22 253.21 0 271.25 0H288.7l-25.64 29.53-19.05 21.94L134.84 177.18 59.29 90.18l19.11-22.01 52.66 60.65c1.99 2.3 5.56 2.3 7.55 0" fill="#fff" /></svg>
                <span className="credit-text">Website by <b>TeekOps</b><span className="credit-tag"> · Tech Done Right.</span></span>
              </a>
            </div>
          </div>
          <footer className="footer">
            <span>© Metromax SportsFest · Community Tournament</span>
            <span>Made with care for our community 💙🦁 · Website by <a href="https://www.teekops.com/" target="_blank" rel="noopener"><b>TeekOps</b></a></span>
          </footer>
        </main>
      </div>
    </>
  );
}
