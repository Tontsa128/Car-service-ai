import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Car Service AI",
  description: "Modern SaaS workshop operating system for automotive repair businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fi">
      <body>{children}</body>
    </html>
  );
}
