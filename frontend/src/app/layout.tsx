import type { Metadata } from "next";
import "@/styles/globals.css";
import Navbar from "@/components/layout/Navbar";
import PageTransition from "@/components/layout/PageTransition";
import ForestAtmosphere from "@/components/layout/ForestAtmosphere";
import RouteGuard from "@/components/layout/RouteGuard";

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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('fra_theme');
                if (t === 'dawn') {
                  document.documentElement.classList.add('dawn');
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('dawn');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <div className="fra-app">
          <ForestAtmosphere />
          <Navbar />
          <main className="relative z-10 min-h-[calc(100vh-var(--header-height))] app-surface">
            <RouteGuard>
              <PageTransition>{children}</PageTransition>
            </RouteGuard>
          </main>
        </div>
      </body>
    </html>
  );
}
