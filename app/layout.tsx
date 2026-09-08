import type { Metadata } from "next";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";

export const metadata: Metadata = {
  title: "mediTicket — Book a Hospital Appointment",
  description: "Choose a service, pick a time, and pay securely with Stripe.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
