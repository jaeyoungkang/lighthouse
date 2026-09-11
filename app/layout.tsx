import type { Metadata } from "next";
import { Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import { ErrorReporter } from "@/app/components/error-reporter";
import { t } from "@/app/i18n/message-access";
import "./globals.css";

const bodyFont = Noto_Sans_KR({
  variable: "--app-font-sans",
  display: "swap",
  preload: false,
  weight: ["400", "500", "600", "700"],
});

const displayFont = Noto_Serif_KR({
  variable: "--app-font-display",
  display: "swap",
  preload: false,
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Moonlight Search",
    template: "%s | Moonlight Search",
  },
  description: t("common.label.layout"),
  icons: {
    icon: [{ url: "/favicon.ico?v=moonlight-search", type: "image/png", sizes: "128x128" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${displayFont.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <ErrorReporter />
        <div className="lh-app-frame flex h-screen overflow-hidden">{children}</div>
      </body>
    </html>
  );
}
