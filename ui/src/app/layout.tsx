import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "F1 Knowledge Assistant | AI-Powered Formula 1 Expert",
  description: "Your expert Formula 1 companion powered by AI. Ask anything about drivers, teams, races, championships, and F1 history with comprehensive data from recent seasons.",
  keywords: ["Formula 1", "F1", "Racing", "AI Assistant", "Drivers", "Teams", "Championships"],
  authors: [{ name: "F1 RAG AI" }],
  openGraph: {
    title: "F1 Knowledge Assistant",
    description: "AI-powered Formula 1 expert with comprehensive racing data",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
