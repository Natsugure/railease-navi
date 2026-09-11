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

// ホーム図のサイン用書体。@furatora/platform-diagram/styles.css の --font-sign が参照する
// 変数クラスは <html> に付けること。--font-sign は :root で宣言されており、中の var() は
// :root 時点で解決される。<body> に付けると :root では未定義となり --font-sign 全体が無効になる
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
    <html lang="ja" className={bizUdpGothic.variable} suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
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
