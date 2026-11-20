import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist_Mono, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// The Grid UI kit's faces: Inter (variable, optical size on) for words and
// Geist Mono for references and codes. next/font serves them from this origin.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], axes: ["opsz"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Medora", template: "%s · Medora" },
  description: "Medora: the telehealth operating platform",
  robots: { index: false, follow: false },
};

/**
 * The app's root. Every page renders per request, because each one carries
 * its own content security policy nonce (src/proxy.ts); reading the
 * headers here is what makes that so.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en-AU" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} h-full`}>
      <body className="grid-ui min-h-full font-sans antialiased">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
