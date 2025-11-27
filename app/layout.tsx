import type { Metadata } from "next";
import Header from "./components/header/Header";
import Footer from "./components/footer/Footer";
import "./globals.scss";
import { merriweather } from "./font";
import { Providers } from "../app/components/providers";

export const metadata: Metadata = {
  title: "Eff Craft",
  description: "Votre univers de bijoux en bois sculpté à la main",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet" />
      </head>
      <body className={merriweather.className}>
        <Providers>
          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
