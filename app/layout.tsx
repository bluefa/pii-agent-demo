import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "@/app/globals.css";
import { ToastProvider } from "@/app/components/ui/toast";
import { cn } from "@/lib/theme";

// The UI is Korean and Geist ships no Hangul, so every Korean string fell through to whatever the
// OS picked (Apple SD Gothic Neo on macOS, Malgun Gothic or a generic sans on Windows): metrics and
// weights differed per machine, and `font-extrabold` had no 800 face to land on. Pretendard covers
// Hangul + latin + digits in one family with real 400-800 weights. Files are the KS X 1001 subset
// build (~260KB each); the CSS variable name stays --font-geist-sans so consumers need no change.
const pretendard = localFont({
  variable: "--font-geist-sans",
  display: "swap",
  src: [
    { path: "./fonts/Pretendard-Regular.subset.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Pretendard-Medium.subset.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Pretendard-SemiBold.subset.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Pretendard-Bold.subset.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Pretendard-ExtraBold.subset.woff2", weight: "800", style: "normal" },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PII Agent",
  description: "Cloud Provider PII Agent 연동 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={cn(pretendard.variable, geistMono.variable, 'antialiased')}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
