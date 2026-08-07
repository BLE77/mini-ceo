import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "./readable-theme.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host =
    incomingHeaders.get("x-forwarded-host") ||
    incomingHeaders.get("host") ||
    "mini-ceo.app";
  const protocol =
    incomingHeaders.get("x-forwarded-proto") ||
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Mini CEO - Your boss in your pocket",
      template: "%s | Mini CEO",
    },
    description:
      "Turn creator goals, references, and ideas into a production schedule with an AI boss who keeps you accountable until you publish.",
    applicationName: "Mini CEO",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Mini CEO",
    },
    formatDetection: { telephone: false },
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      url: origin,
      title: "Mini CEO - Your boss in your pocket",
      description:
        "A character-first creator operating system that keeps showing up until the content gets posted.",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1536,
          height: 1024,
          alt: "Mini CEO - Your boss in your pocket",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Mini CEO - Your boss in your pocket",
      description:
        "Turn creator goals and inspiration into a real production schedule.",
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#aaa7a1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
