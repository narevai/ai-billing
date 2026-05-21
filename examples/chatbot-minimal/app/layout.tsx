import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Billing — Minimal Chatbot',
  description: 'Minimal chatbot example with AI Billing (Polar)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
