import type { Metadata, Viewport } from 'next';
import Shell from '@/components/Shell';
import TournamentProvider from '@/components/TournamentProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Metromax SportsFest | Fixtures, Results & Standings',
  description: 'Metromax Sports Season XVI — fixtures, match results, player journeys and team points.',
  icons: { icon: '/brand/mmx-wizardz.webp' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#071b2c' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TournamentProvider>
          <Shell>{children}</Shell>
        </TournamentProvider>
      </body>
    </html>
  );
}
