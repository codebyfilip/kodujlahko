import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://www.kodujlahko.sk";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "KodujLahko – Nauč sa programovať po slovensky",
    template: "%s | KodujLahko",
  },
  description:
    "KodujLahko je slovenská platforma na učenie kódovania. Nauč sa HTML, CSS a JavaScript cez interaktívne lekcie, výzvy a XP systém. Zadarmo, po slovensky.",
  keywords: [
    "programovanie pre začiatočníkov",
    "naučiť sa kódovať",
    "HTML kurz slovenčina",
    "CSS kurz slovenčina",
    "JavaScript kurz slovenčina",
    "online kurzy programovania",
    "kódovanie zadarmo",
    "kodujlahko",
    "učenie programovania slovensko",
    "webdizajn kurz",
  ],
  authors: [{ name: "KodujLahko" }],
  creator: "KodujLahko",
  publisher: "KodujLahko",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      "sk-SK": siteUrl,
    },
  },
  openGraph: {
    type: "website",
    locale: "sk_SK",
    url: siteUrl,
    siteName: "KodujLahko",
    title: "KodujLahko – Nauč sa programovať po slovensky",
    description:
      "Interaktívne lekcie HTML, CSS a JavaScript pre úplných začiatočníkov. Zarábaj XP, súťaž so spolužiakmi a stávaj sa lepším vývojárom.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "KodujLahko – Slovenská platforma na učenie programovania",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KodujLahko – Nauč sa programovať po slovensky",
    description:
      "Interaktívne lekcie HTML, CSS a JavaScript pre úplných začiatočníkov. Zarábaj XP, súťaž so spolužiakmi a stávaj sa lepším vývojárom.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  category: "education",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Momo+Trust+Display&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap" rel="stylesheet" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com"  />
        <link href="https://fonts.googleapis.com/css2?family=Momo+Trust+Display&family=Nunito:ital,wght@0,200..1000;1,200..1000&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet" />


      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
