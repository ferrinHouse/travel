import { Fraunces, Inter } from 'next/font/google';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/components.css';
import '@/styles/utilities.css';
import Providers from '@/components/ui/Providers';
import SiteHeader from '@/components/site/SiteHeader';
import { THEME_COLORS, themeInitScript } from '@/lib/theme';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });

export const metadata = {
  title: {
    default: 'Family Travel Adventures',
    template: '%s | Family Travel Adventures',
  },
  description: 'Itineraries, checklists and meal plans for our upcoming and past family adventures.',
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
  ],
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    // The inline script sets data-theme before paint, so <html> differs from the server render.
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
