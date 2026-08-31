import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mangal Traders · QR Review Experience",
  description: "Partner demo for a zero-friction QR review workflow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
