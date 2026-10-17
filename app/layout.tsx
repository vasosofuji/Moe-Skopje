import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { RefractionFilter } from "@/components/glass/RefractionFilter";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";
import "./layout-tokens.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Мое Скопје",
};

// viewport-fit=cover lets the map run under the notch and home indicator; env(safe-area-inset-*) then keeps chrome clear.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="mk" className={inter.variable}>
      <body>
        <I18nProvider>
          <RefractionFilter />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
