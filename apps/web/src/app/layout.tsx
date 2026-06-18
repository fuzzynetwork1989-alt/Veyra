import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SettingsProvider } from "@/components/settings-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Veyra - Developer-First AI Platform",
  description: "Plan, build, test, deploy, and operate software systems with AI",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
