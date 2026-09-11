import type { Metadata } from 'next';
import { BIZ_UDPGothic } from 'next/font/google';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import '@furatora/platform-diagram/styles.css';
import { AdminShell } from '@/components/AdminShell';
import { auth } from '@/auth';
import './globals.css';

// ホーム図（駅レイアウト統合ページ、Issue #95）のサイン用書体。
// apps/web/src/app/layout.tsx と同じパターン（@furatora/platform-diagram/styles.css
// の --font-sign が --font-biz-udpgothic を参照する）
const bizUdpGothic = BIZ_UDPGothic({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-biz-udpgothic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Admin - ふらとら',
  description: 'Administration panel',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body className={bizUdpGothic.variable}>
        <MantineProvider defaultColorScheme="light">
          <Notifications />
          {session ? (
            <AdminShell>{children}</AdminShell>
          ) : (
            <main style={{ padding: '1.5rem' }}>{children}</main>
          )}
        </MantineProvider>
      </body>
    </html>
  );
}
