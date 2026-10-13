import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
  title: {
    default: "MovieDekho — Movies & Web Series, Free Streaming",
    template: "%s · MovieDekho",
  },
  description:
    "MovieDekho is a Netflix-style streaming app for movies and web series, with multi-server mirrors, TMDB-powered discovery and a personal watchlist.",
  applicationName: "MovieDekho",
  keywords: [
    "movies",
    "web series",
    "streaming",
    "watch online",
    "bollywood",
    "hollywood",
    "TMDB",
  ],
  openGraph: {
    type: "website",
    siteName: "MovieDekho",
    title: "MovieDekho — Movies & Web Series, Free Streaming",
    description:
      "Netflix-style streaming with multi-server mirrors, TMDB-powered discovery and a personal watchlist.",
  },
};

export const viewport: Viewport = {
  themeColor: "#04060b",
  width: "device-width",
  initialScale: 1,
};

import { Suspense } from "react";
import Navbar from "@/components/Navbar";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Navbar is fixed-position, so it sits above the streamed content. */}
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
