import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Providers from "./providers";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Head Hunter",
  description: "Find the best recordings of jazz standards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <header className="sticky top-0 z-40 border-b bg-background/60 backdrop-blur">
            <div className="container flex h-14 items-center justify-between">
              <Link href="/" className="font-semibold tracking-tight text-lg">
                <span className="bg-gradient-to-r from-fuchsia-500 via-sky-500 to-emerald-500 bg-clip-text text-transparent">Head Hunter</span>
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <ThemeToggle />
                <Link href="/login" className="underline">
                  Account
                </Link>
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
