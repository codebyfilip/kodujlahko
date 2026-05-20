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
    default: "KódujĽahko – Nauč sa programovať po slovensky | HTML, CSS, JavaScript",
    template: "%s | KódujĽahko",
  },
  description:
    "KódujĽahko je najlepšia slovenská platforma na učenie programovania. Nauč sa HTML, CSS a JavaScript online, zadarmo, po slovensky. Interaktívne lekcie pre úplných začiatočníkov.",
  keywords: [
    "kodujlahko",
    "koduj lahko",
    "kóduj ľahko",
    "kódujlahko",
    "ucenie HTML",
    "ucenie HTML slovensky",
    "HTML kurz zadarmo",
    "HTML pre zaciatocnikov",
    "naucit sa HTML",
    "HTML online kurz",
    "zaklady HTML",
    "ucenie CSS",
    "CSS kurz zadarmo",
    "CSS pre zaciatocnikov",
    "naucit sa CSS",
    "ucenie JavaScript",
    "JavaScript kurz zadarmo",
    "JavaScript pre zaciatocnikov",
    "naucit sa JavaScript",
    "JS kurz slovensky",
    "tvorba webov",
    "tvorba webovych stranok",
    "naucit sa tvorit weby",
    "web development slovensky",
    "webdizajn kurz",
    "programovanie pre zaciatocnikov",
    "naucit sa programovat",
    "programovanie slovensky",
    "online kurzy programovania",
    "kodovanie zadarmo",
    "programovanie online",
    "slovensky kurz programovania",
    "ucenie programovania slovensko",
    "coding slovencina",
    "slovensky sa ucit HTML",
    "slovensky sa ucit programovat",
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
  category: "education",
  verification: {
    google: "UMdlMhl1tn4rpYN77nPf_3B2OBfABQo-gulasg0iPxY",
  },
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
