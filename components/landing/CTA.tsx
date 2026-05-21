'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FiArrowRight, FiCheck } from 'react-icons/fi';

function getCtaHref() {
  if (typeof document === 'undefined') return '/signup';
  const visited = document.cookie.split(';').some(c => c.trim().startsWith('kl_visited='));
  return visited ? '/login' : '/signup';
}

export default function CTA() {
  const [ctaHref, setCtaHref] = useState('/signup');

  useEffect(() => {
    setCtaHref(getCtaHref());
  }, []);

  return (
    <section className="relative py-16 sm:py-32 px-4 sm:px-6 bg-white overflow-hidden">
      <div className="absolute top-0 left-0 w-72 h-72 bg-[#7361FF]/10 rounded-full blur-[90px]" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#8C78FF]/10 rounded-full blur-[100px]" />

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="mx-auto w-full sm:w-[85%] lg:w-[70%] rounded-[2rem] sm:rounded-[3rem] px-6 sm:px-14 py-10 sm:py-16 text-center bg-linear-to-br from-[#7361FF] to-[#8C78FF] shadow-[0_20px_60px_rgba(115,97,255,0.35)] overflow-hidden relative">

          <div className="absolute top-4 right-4 grid grid-cols-4 gap-2 opacity-20 pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="w-2 h-2 bg-white/30 rounded-full" />
            ))}
          </div>
          <div className="absolute bottom-0 left-0 w-60 h-40 bg-white/10 rounded-tr-[3rem] blur-2xl opacity-20" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-28 bg-white/15 rounded-b-[5rem] blur-3xl opacity-30" />

          <h2
            className="text-2xl sm:text-4xl lg:text-5xl font-semibold text-white mb-5 sm:mb-8 leading-tight drop-shadow-lg"
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          >
            Priprav sa začať tvoriť
            <br />
            <span className="opacity-90">svoj prvý web ešte dnes</span>
          </h2>

          <p className="nunito text-white/85 text-base sm:text-xl max-w-xl mx-auto mb-8 sm:mb-12 leading-relaxed">
            Buduj svoje skills postupne a bez zbytočného chaosu. Učíš sa, skúšaš, rastieš — všetko na jednom mieste.
          </p>

          <div className="flex justify-center px-4 sm:px-0">
            <Link
              href={ctaHref}
              className="group relative inline-flex items-center gap-2 w-full sm:w-auto justify-center px-10 py-4 bg-white text-[#7361FF] font-semibold rounded-2xl text-base sm:text-lg shadow-xl hover:shadow-[0_8px_30px_rgba(255,255,255,0.25)] transition-all duration-400 hover:scale-105 nunito active:scale-[0.98]"
            >
              Začať zadarmo
              <FiArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 mt-8 sm:mt-12 text-white/70 nunito text-sm">
            <div className="flex items-center gap-2"><FiCheck className="w-4 h-4 shrink-0" /> Žiadne inštalácie</div>
            <div className="flex items-center gap-2"><FiCheck className="w-4 h-4 shrink-0" /> Pre úplných začiatočníkov</div>
            <div className="flex items-center gap-2"><FiCheck className="w-4 h-4 shrink-0" /> Všetko v prehliadači</div>
          </div>
        </div>
      </div>
    </section>
  );
}
