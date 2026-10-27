import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Shell from '@/components/Shell';
import TournamentProvider from '@/components/TournamentProvider';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://metro-max-sports.onrender.com'),
  title: 'Metromax SportsFest | Fixtures, Results & Standings',
  description: 'Metromax Sports Season XVI — fixtures, match results, player journeys and team points.',
  icons: { icon: '/brand/metromax-sports.jpg', apple: '/brand/metromax-sports.jpg' },
  openGraph: {
    title: 'Metromax SportsFest | Fixtures, Results & Standings',
    description: 'Metromax Sports Season XVI — fixtures, match results, player journeys and team points.',
    url: '/',
    siteName: 'Metromax SportsFest',
    images: [{ url: '/brand/metromax-sports.jpg', width: 820, height: 1024, alt: 'Metro Max Sports logo' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Metromax SportsFest | Fixtures, Results & Standings',
    description: 'Metromax Sports Season XVI — fixtures, match results, player journeys and team points.',
    images: ['/brand/metromax-sports.jpg'],
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#071b2c' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-W9NGS2S2NB" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-W9NGS2S2NB');
        `}</Script>
        <TournamentProvider>
          <Shell>{children}</Shell>
        </TournamentProvider>
      </body>
    </html>
  );
}
