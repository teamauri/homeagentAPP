import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";
import { RobotEventProvider } from "@/components/RobotEventContext";

export const metadata: Metadata = {
  title: "Auri",
  applicationName: "Auri",
  description: "Auri home agent app",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/auri-icon.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Auri",
  },
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
