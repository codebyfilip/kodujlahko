import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registrácia – KódujĽahko",
  description:
    "Vytvor si bezplatný účet na KódujĽahko a začni sa učiť HTML, CSS a JavaScript po slovensky. Registrácia zadarmo, žiadna kreditná karta.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://www.kodujlahko.sk/signup",
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
