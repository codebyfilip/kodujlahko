import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zabudnuté heslo – KódujĽahko",
  description: "Obnov prístup k svojmu účtu na KódujĽahko.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
