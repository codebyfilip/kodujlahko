import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import About from "@/components/landing/About";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import HowItWorks from "@/components/landing/HowItWorks";
import Showcase from "@/components/landing/Showcase";
import Testimonials from "@/components/landing/Testimonials";
import Features from "@/components/landing/Features";

export const metadata: Metadata = {
  title: "KódujĽahko – Nauč sa HTML, CSS a JavaScript po slovensky zadarmo",
  description:
    "Nauč sa programovať na KódujĽahko – slovenskej platforme pre začiatočníkov. Interaktívne lekcie HTML, CSS, JavaScript. Zadarmo, online, po slovensky. Začni ešte dnes.",
  alternates: {
    canonical: "https://www.kodujlahko.sk",
  },
  openGraph: {
    title: "KódujĽahko – Nauč sa HTML, CSS a JavaScript po slovensky zadarmo",
    description:
      "Slovenská platforma na učenie programovania. HTML, CSS, JavaScript – interaktívne lekcie, XP systém, výzvy. Zadarmo a po slovensky.",
    url: "https://www.kodujlahko.sk",
    type: "website",
  },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-linear-to-br bg-white">
      <Navbar />
      <Hero />
      <About />
      <HowItWorks />
      <Features />
     
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  );
}