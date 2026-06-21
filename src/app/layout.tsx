import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";
import { RobotEventProvider } from "@/components/RobotEventContext";

export const metadata: Metadata = {
  title: "Auri Family OS",
  description: "App-first family AI operating layer demo",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RobotEventProvider>{children}</RobotEventProvider>
      </body>
    </html>
  );
}
