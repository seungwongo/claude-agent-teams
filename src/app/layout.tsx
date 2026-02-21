import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Agent Teams – Kanban Monitor",
  description: "Real-time Kanban board for monitoring Claude agent teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
