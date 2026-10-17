import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { RefractionFilter } from "@/components/glass/RefractionFilter";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Мое Скопје",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="mk" className={inter.variable}>
      <body>
        <RefractionFilter />
        {children}
      </body>
    </html>
  );
}
