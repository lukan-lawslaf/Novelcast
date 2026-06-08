import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovelCast",
  description: "Multi-voice AI audiobook casting for novels"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400..700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen font-ui antialiased">
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
