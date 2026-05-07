import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import About from "@/components/landing/About";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import HowItWorks from "@/components/landing/HowItWorks";
import Showcase from "@/components/landing/Showcase";
import Testimonials from "@/components/landing/Testimonials";
import Features from "@/components/landing/Features";


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