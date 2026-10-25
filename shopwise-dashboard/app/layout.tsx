import type { Metadata } from 'next';
import { AppShell } from '@/components/AppShell';
// Fonts are bundled with the app (no request to Google at runtime or build time).
import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shopwise',
  description: 'WhatsApp ordering and inventory for small vendors',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stone-50 font-sans text-stone-900 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
