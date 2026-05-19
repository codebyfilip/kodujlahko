import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prihlásenie – KódujĽahko",
  description:
    "Prihlás sa do KódujĽahko a pokračuj v učení HTML, CSS a JavaScript. Slovenská platforma na programovanie pre začiatočníkov.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://www.kodujlahko.sk/login",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
