import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/shared/Sidebar";
import Topbar from "@/components/shared/Topbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AeroFlux",
  description: "AeroFlux travel agency platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
        <Sidebar />
        <div className="flex flex-col flex-1 pl-64 w-full h-full relative overflow-y-auto">
          <Topbar />
          <main className="flex-1 mt-16">{children}</main>
        </div>
      </body>
    </html>
  );
}
