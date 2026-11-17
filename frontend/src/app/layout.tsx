import type { Metadata } from "next";
import { EB_Garamond, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const garamond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-garamond",
  display: "swap",
  style: ["normal", "italic"],
});

const vietnam = Be_Vietnam_Pro({
  subsets: ["latin"],
  variable: "--font-vietnam",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Reconciliation Engine",
  description: "Motor de reconciliación financiera multi-tenant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${garamond.variable} ${vietnam.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
