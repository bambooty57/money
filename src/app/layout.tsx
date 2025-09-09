import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { RefreshProvider } from "@/lib/refresh-context";
import { ToastProvider } from '@/components/ui/alert';
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "크레딧-노트 | 구보다농기계 영암대리점",
  description: "채권 관리 솔루션",
  manifest: "/manifest.json",
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then((registration) => {
                      console.log('✅ 서비스 워커 등록 성공:', registration.scope);
                    })
                    .catch((error) => {
                      console.log('❌ 서비스 워커 등록 실패:', error);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning={true}>
        <ToastProvider>
          <RefreshProvider>
            <Navigation />
            <main className="min-h-screen bg-gray-50">
              {children}
            </main>
          </RefreshProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
