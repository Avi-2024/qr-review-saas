import type { Metadata } from "next";
import "./globals.css";
import "./customer-flow.css";
import "./merchant.css";
import "./onboarding.css";
import "./topics.css";
import "./qr-analytics.css";
import "./workspace-theme.css";

export const metadata: Metadata = {
  title: "NFC & QR Review · Customer Feedback & Reputation",
  description: "Tap an NFC review card or scan a QR code to share authentic customer feedback with an editable Google review handoff.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
