import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Drobe — Your wardrobe, understood.",
  description: "Personal wardrobe intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/*
          Fontshare's v2 CSS endpoint only returns @font-face rules for the
          first f[] font in the query string — a single combined link silently
          drops every font after the first, so each family needs its own link.
        */}
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-display@700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
