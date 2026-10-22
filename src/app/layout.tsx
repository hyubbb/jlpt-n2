import type { Metadata } from "next";
import { Geist, Geist_Mono, Klee_One } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Japanese glyphs are split into unicode-range chunks, so skip preloading.
const kleeOne = Klee_One({
  variable: "--font-klee-one",
  weight: ["400", "600"],
  preload: false,
});

export const metadata: Metadata = {
  title: "JLPT 단어·문법",
  description: "JLPT N5–N1 단어 카드, 예문, 문법 학습장.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${kleeOne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
