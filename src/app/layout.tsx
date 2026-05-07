import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/layout/providers";
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
  applicationName: "Skytells Spark",
  title: {
    default: "Skytells Spark | AI SaaS Application Workspace",
    template: "%s | Skytells Spark",
  },
  description:
    "Build production-ready AI SaaS applications with Skytells models, databases, generated assets, workflows, and container-native deployment.",
  keywords: [
    "Skytells",
    "AI app builder",
    "AI SaaS template",
    "generated assets",
    "Postgres",
    "libSQL",
    "Redis",
    "Orchestrator",
    "deployment",
  ],
  authors: [{ name: "Skytells" }],
  creator: "Skytells",
  publisher: "Skytells",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "Skytells Spark",
    title: "Skytells Spark | AI SaaS Application Workspace",
    description:
      "A production-ready workspace for building AI products with code, design, images, video, audio, databases, and secure deployment.",
    images: [
      {
        url: "/images/spark.jpg",
        width: 1691,
        height: 930,
        alt: "Skytells Spark — AI SaaS Application Workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Skytells Spark | AI SaaS Application Workspace",
    description:
      "Create complete AI SaaS applications with generated code, licensed assets, databases, workflows, and deployment guidance.",
    images: ["/images/spark.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {/*
          Runs synchronously in <head> before any CSS paint.
          Adds `.dark` to <html> so the browser never renders the light flash.
          next/script with beforeInteractive is the correct React 19–safe way to do this.
        */}
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('skytells-theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark')}catch(e){document.documentElement.classList.add('dark')}})()` }} />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
