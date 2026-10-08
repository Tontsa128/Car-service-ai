import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";
import "./modules.css";

export const metadata: Metadata = {
  title: "Car Service AI",
  description: "AI-avusteinen Workshop OS autokorjaamoille.",
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
