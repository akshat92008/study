import type { Metadata } from 'next';
import './globals.css';
import { validateEnvironment } from '@/lib/utils/env-check';

validateEnvironment(); // Runs at app startup

export const metadata: Metadata = {
  title: 'Cognition OS — AI-Powered Learning Operating System',
  description: 'An AI-native system that continuously models your knowledge, memory, behavior, and performance to autonomously optimize your learning outcomes.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
