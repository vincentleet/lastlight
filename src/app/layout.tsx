import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Last Light",
  description: "A rogue-lite PvP dice race, hosted on Habbo Origins.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
