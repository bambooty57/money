import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { RefreshProvider } from "@/lib/refresh-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "크레딧-노트 | 구보다농기계 영암대리점",
  description: "채권 관리 솔루션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <RefreshProvider>
          <Navigation />
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </RefreshProvider>
      </body>
    </html>
  );
}
