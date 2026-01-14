// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "K-career",
  description: "Interview training",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="h-screen overflow-hidden">
        <div className="h-screen overflow-hidden">{children}</div>
      </body>
    </html>
  );
}
