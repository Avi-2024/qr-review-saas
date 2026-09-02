import type { Metadata } from "next";
import "./globals.css";
import "./customer-flow.css";
import "./merchant.css";

export const metadata: Metadata = {
  title: "QR Review · Customer Feedback & Reputation",
  description: "QR-powered customer review, feedback and reputation intelligence platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
