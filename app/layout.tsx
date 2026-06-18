import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, Unbounded } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "optional",
});

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
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable} ${unbounded.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
