import type {Metadata} from 'next';
import { Space_Grotesk, Inter } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Cognition OS | Your AI Learning Operating System',
  description: 'Upload sources, study with an AI tutor, autopsy your mistakes, and turn every session into your next mission.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} dark`}>
      <body className="font-sans antialiased bg-[#030014] text-slate-100 selection:bg-purple-500/30 min-h-screen flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
