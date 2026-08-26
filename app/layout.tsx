import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/app/globals.css";
import { cookies } from "next/headers";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import { ToastProvider } from "@/app/components/ui/toast";
import { LOCALE_COOKIE_NAME, parseLocaleCookie } from "@/lib/locale";
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

export const metadata: Metadata = {
  title: "PII Agent",
  description: "Cloud Provider PII Agent 연동 관리 시스템",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The language rides in a cookie so this first paint already speaks it — see lib/locale.ts.
  const locale = parseLocaleCookie((await cookies()).get(LOCALE_COOKIE_NAME)?.value);
  return (
    <html lang={locale}>
      <body
        className={cn(pretendard.variable, 'antialiased')}
      >
        <LocaleProvider initial={locale}>
          <ToastProvider>{children}</ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
