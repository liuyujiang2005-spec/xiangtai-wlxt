import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthBar } from "@/app/components/AuthBar";
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
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-base font-semibold tracking-wide text-brand">湘泰物流</p>
            <div className="flex flex-1 items-center justify-end gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs text-slate-500">结算币种</p>
                <p className="text-sm font-medium text-slate-700">人民币（CNY）</p>
              </div>
              <AuthBar />
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
