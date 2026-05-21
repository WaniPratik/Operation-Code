import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "@/app/globals.css";
import { Providers } from "@/app/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { FeedbackWidget } from "@/components/ui/feedback-widget";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Anonymous Voice Match MVP",
  description:
    "Web-first MVP for anonymous voice matching with persisted guest sessions, queueing, live voice rooms, moderation actions, audit logging, and a simple protected admin dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${headingFont.variable} ${monoFont.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <FeedbackWidget />
          </div>
        </Providers>
      </body>
    </html>
  );
}
