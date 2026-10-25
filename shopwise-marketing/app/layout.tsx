import type { Metadata } from 'next';
// Fonts are bundled with the app (no request to Google at runtime or build time).
import '@fontsource-variable/inter';
import '@fontsource-variable/source-serif-4';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shopwise | WhatsApp orders, sorted',
  description:
    'WhatsApp ordering, inventory and sales tracking for small online sellers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
