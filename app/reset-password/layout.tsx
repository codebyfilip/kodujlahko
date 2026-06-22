import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nové heslo – KódujĽahko",
  description: "Nastav si nové heslo pre tvoj účet na KódujĽahko.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
