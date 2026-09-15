import type { Metadata } from 'next';
import { Manrope, Lora } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600'] });
const lora = Lora({ subsets: ['latin'], variable: '--font-lora' });

export const metadata: Metadata = {
  title: 'Shopwise',
  description: 'WhatsApp ordering and inventory for small vendors',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={lora.variable}>
      <body className={`${manrope.className} bg-stone-50 text-stone-900 antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
