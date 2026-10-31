import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Doto, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { Fx } from "@/components/markit/blo";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-geist-mono" });
const doto = Doto({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-doto" });

export const metadata: Metadata = {
  title: { default: "Markit · your market copilot", template: "%s · Markit" },
  description: "Tell Markit what you sell and where. It finds the companies with a reason to buy, the people who decide, and writes the first email.",
  icons: { icon: "/markit.svg" },
};

// Dark-only: browser chrome, scrollbars and form controls match the app on every OS theme.
export const viewport: Viewport = { colorScheme: "dark", themeColor: "#0E0E0D" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${doto.variable}`}>
      <body>
        <Fx />
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <Toaster position="bottom-center" toastOptions={{ unstyled: true, classNames: { toast: "mk-toast" } }} />
      </body>
    </html>
  );
}
