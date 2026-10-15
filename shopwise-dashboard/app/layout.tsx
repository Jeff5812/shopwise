import type { Metadata } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Shopwise',
  description: 'WhatsApp ordering and inventory for small vendors',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body className="bg-stone-50 font-sans text-stone-900 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
