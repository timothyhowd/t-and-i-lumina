import type { Metadata } from 'next';
import { PocBanner } from '@/components/PocBanner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lumina — PoC',
  description: 'AI-driven HR document automation. Proof of concept. Not for production use.',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink">
        <PocBanner />
        {children}
      </body>
    </html>
  );
}
