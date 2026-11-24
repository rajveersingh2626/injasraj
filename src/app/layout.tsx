import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#09090b' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://injasraj-classroom.vercel.app'),
  title: 'Injasraj - International 1:1 Video Classroom',
  description:
    'Frictionless international 1:1 video classroom with cross-timezone booking and real-time WebRTC media.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-[100dvh] antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        <script
          type="module"
          dangerouslySetInnerHTML={{
            __html: `try{import('/pdf.min.mjs').then(function(m){var lib=m.default||m;if(lib&&lib.GlobalWorkerOptions){lib.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';}window.pdfjsLib=lib;}).catch(function(){});}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
