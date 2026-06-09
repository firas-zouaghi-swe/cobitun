import React from 'react';
import type { Metadata } from "next";
import { Montserrat, Inter, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { I18nProvider } from "@/components/I18nProvider";
import { AuthProvider } from "@/components/AuthProvider";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "COBITUN — Cloud Outage Business Interruption Tunisia Cover",
  description: "No claims forms, no adjusters, no waiting.",
  keywords: ["COBITUN", "Parametric Insurance", "Cloud Outage", "Tunisia", "IODA", "Business Interruption", "SLA"],
  icons: {
    icon: '/favicon.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'COBITUN — Cloud Outage Business Interruption Tunisia Cover',
    description: "Tunisia's first parametric cloud outage insurance portal. Automatic payouts powered by IODA.",
    siteName: 'COBITUN',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserrat.variable} ${inter.variable} ${notoSansArabic.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
      >
        <I18nProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange={false}
          >
            <AuthProvider>
              {children}
              <Toaster position="top-right" richColors />
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

