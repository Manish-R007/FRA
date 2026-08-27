import type { Metadata } from "next";
import "@/styles/globals.css";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "FRA ATLAS AI | Ministry of Tribal Affairs Decision Support System",
  description: "AI-Powered Forest Rights Act Atlas & WebGIS-Based Decision Support System (DSS) for Integrated Monitoring of FRA Implementation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="light-ui min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-emerald-500 selection:text-white">
        <Navbar />
        <main className="min-h-[calc(100vh-var(--header-height))] app-surface">
          {children}
        </main>
      </body>
    </html>
  );
}
