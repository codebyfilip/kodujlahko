'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="relative bg-gradient-to-br from-[#7361FF] to-[#8C78FF] pt-20 pb-12 text-white overflow-hidden">

      <div className="max-w-7xl mx-auto px-6">

        {/* TOP: Logo + názov */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-14">
          
          {/* Logo + text */}
          <div className="flex items-center gap-4 mb-10 md:mb-0">
            <Image
              src="/logo.png"
              width={50}
              height={50}
              alt="KodujLahko Logo"
              className="rounded-xl "
            />

            <h3
              className="text-3xl font-semibold"
              style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
            >
              KodujĽahko
            </h3>
          </div>

        </div>

        {/* GRID – 3 stĺpce */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">

          {/* 1. Platforma */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Platforma</h4>

            <ul className="space-y-3 text-white/80 nunito">
              <li><Link href="#home" className="hover:text-white transition">Domov</Link></li>
              <li><Link href="#about" className="hover:text-white transition">O projekte</Link></li>
              <li><Link href="#how-it-works" className="hover:text-white transition">Ako to funguje</Link></li>
              <li><Link href="#features" className="hover:text-white transition">Funkcie</Link></li>
            </ul>
          </div>

          {/* 2. Učenie */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Učenie</h4>

            <ul className="space-y-3 text-white/80 nunito">
              <li><Link href="#" className="hover:text-white transition">HTML</Link></li>
              <li><Link href="#" className="hover:text-white transition">CSS</Link></li>
              <li><Link href="#" className="hover:text-white transition">JavaScript</Link></li>
            </ul>
          </div>

          {/* 3. Kontakt */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Kontakt</h4>

            <ul className="space-y-3 text-white/80 nunito">
              <li>Email:
                <a href="mailto:support@kodujlahko.sk" className="hover:text-white transition"> support@kodujlahko.sk</a>
              </li>
              <li>
                Instagram: <a href="#" className="hover:text-white transition">@kodujlahko</a>
              </li>
            </ul>
          </div>

        </div>

        {/* Divider */}
        <div className="my-12 border-t border-white/20"></div>

        {/* BOTTOM – copyright */}
        <div className="text-center text-white/70 nunito">
          © {new Date().getFullYear()} <span className="font-semibold text-white">KodujĽahko</span>.  
          Všetky práva vyhradené.
        </div>

      </div>
    </footer>
  );
}
