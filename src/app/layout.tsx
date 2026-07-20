import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { AppShell } from "@/components/layout/app-shell";
import { AppThemeProvider } from "@/components/theme/app-theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vSphere Desired State",
  description:
    "Compare and rectify Desired State configuration across ESX hosts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <InitColorSchemeScript
          attribute="class"
          defaultMode="system"
          modeStorageKey="ds-color-mode"
        />
        <AppThemeProvider>
          <AppShell>{children}</AppShell>
        </AppThemeProvider>
      </body>
    </html>
  );
}