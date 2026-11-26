import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { DistributorProvider } from '@/context/DistributorContext';
import Navbar from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DistroOS — Distributor Operating System',
  description: 'Order, Dispatch, Khata & Analytics Platform for Distributors',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900`}>
        <DistributorProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </main>
        </DistributorProvider>
      </body>
    </html>
  );
}