import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Markit", template: "%s | Markit" },
  description: "Market entry, opportunity discovery, lead intelligence, and personalized sales outreach.",
  icons: { icon: "/markit.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full font-sans antialiased"
    >
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
