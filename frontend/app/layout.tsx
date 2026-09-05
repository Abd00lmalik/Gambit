import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import NetworkGuard from "@/components/NetworkGuard";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Gambit — DreamDEX Duel Layer",
  description: "DreamDEX gives you the market. Gambit gives you someone to trade against.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-carbon font-body text-foam antialiased">
        <Providers>
          <Navbar />
          <NetworkGuard />
          <main className="pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
