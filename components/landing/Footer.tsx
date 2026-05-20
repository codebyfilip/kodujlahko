'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="relative bg-linear-to-br from-[#7361FF] to-[#8C78FF] pt-12 sm:pt-20 pb-8 sm:pb-12 text-white overflow-hidden">

      <div className="max-w-7xl mx-auto px-5 sm:px-6">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 sm:mb-14">
          <div className="flex items-center gap-3 mb-8 sm:mb-0">
            <Image
              src="/logo.png"
              width={44}
              height={44}
              alt="KodujLahko Logo"
              className="rounded-xl"
            />
            <h3
              className="text-2xl sm:text-3xl font-semibold"
              style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
            >
              KodujĽahko
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-12">

          <div>
            <h4 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Platforma</h4>
            <ul className="space-y-2 sm:space-y-3 text-white/80 nunito text-sm sm:text-base">
              <li><Link href="#home" className="hover:text-white transition">Domov</Link></li>
              <li><Link href="#about" className="hover:text-white transition">O projekte</Link></li>
              <li><Link href="#how-it-works" className="hover:text-white transition">Ako to funguje</Link></li>
              <li><Link href="#features" className="hover:text-white transition">Funkcie</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Učenie</h4>
            <ul className="space-y-2 sm:space-y-3 text-white/80 nunito text-sm sm:text-base">
              <li><Link href="#" className="hover:text-white transition">HTML</Link></li>
              <li><Link href="#" className="hover:text-white transition">CSS</Link></li>
              <li><Link href="#" className="hover:text-white transition">JavaScript</Link></li>
            </ul>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <h4 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Kontakt</h4>
            <ul className="space-y-2 sm:space-y-3 text-white/80 nunito text-sm sm:text-base">
              <li>
                <a href="mailto:support@kodujlahko.sk" className="hover:text-white transition break-all">
                  support@kodujlahko.sk
                </a>
              </li>
              <li>
                Instagram: <a href="#" className="hover:text-white transition">@kodujlahko</a>
              </li>
            </ul>
          </div>

        </div>

        <div className="my-8 sm:my-12 border-t border-white/20" />

        <div className="text-center text-white/70 nunito text-sm sm:text-base">
          © {new Date().getFullYear()} <span className="font-semibold text-white">KodujĽahko</span>.{' '}
          Všetky práva vyhradené.
        </div>

      </div>
    </footer>
  );
}
