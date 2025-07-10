import type { Metadata } from "next";
import Header from "./components/header/Header";
import "./globals.scss";
import { merriweather } from "./font";

export const metadata: Metadata = {
  title: "Eff Craft",
  description: "Votre univers de bijoux en bois sculpté à la main",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" >
        <body className={merriweather.className}>
            <Header />
            {children}
        </body>
    </html>
  );
}
