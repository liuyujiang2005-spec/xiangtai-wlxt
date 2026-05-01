import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { GlobalHeader } from "@/app/components/GlobalHeader";
import { RouteHintBanner } from "@/app/components/RouteHintBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "湘泰物流管理系统",
  description: "湘泰物流跨境物流管理系统",
};

/**
 * 根布局组件，统一注入品牌导航与页面主体容器。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GlobalHeader />
        <Suspense fallback={null}>
          <RouteHintBanner />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
