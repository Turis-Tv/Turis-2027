import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Turis Tv",
  description:
    "Turis Tv — kanalları PIN olmadan izleyin; M3U8 bağlantıları ve indirmeler PIN ile korunur.",
  manifest: "/manifest.webmanifest",
  applicationName: "Turis Tv",
  appleWebApp: {
    capable: true,
    title: "Turis Tv",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/turis-tv-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/turis-tv-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/turis-tv-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#dc2626",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body className="overflow-x-hidden bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
