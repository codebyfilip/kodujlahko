'use client';

import Link from 'next/link';

export default function CTA() {
  return (
    <section className="relative py-32 px-6 bg-white overflow-hidden">

      {/* Jemné pozadové blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-[#7361FF]/10 rounded-full blur-[90px]" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#8C78FF]/10 rounded-full blur-[100px]" />

      {/* CTA CARD */}
      <div className="relative mx-auto w-full max-w-6xl">
        <div
          className="
            mx-auto w-[90%] sm:w-[75%] lg:w-[70%]
            rounded-[3rem]
            px-14 py-16 text-center
            bg-gradient-to-br from-[#7361FF] to-[#8C78FF]
            shadow-[0_20px_60px_rgba(115,97,255,0.35)]
            overflow-hidden relative
          "
        >

          {/* Geometric ornaments */}
          <div className="absolute top-6 right-6 grid grid-cols-4 gap-2 opacity-20 pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="w-2 h-2 bg-white/30 rounded-full" />
            ))}
          </div>

          <div className="absolute bottom-0 left-0 w-60 h-40 bg-white/10 rounded-tr-[3rem] blur-2xl opacity-20" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-28 bg-white/15 rounded-b-[5rem] blur-3xl opacity-30" />

          {/* Nadpis */}
          <h2
            className="text-4xl sm:text-5xl font-semibold text-white mb-8 leading-tight drop-shadow-lg"
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          >
            Priprav sa začať tvoriť
            <br />
            <span className="opacity-90">svoj prvý web ešte dnes</span>
          </h2>

          {/* Podnadpis */}
          <p className="nunito text-white/85 text-lg sm:text-xl max-w-xl mx-auto mb-16 leading-relaxed">
           Buduj svoje skills postupne a bez zbytočného chaosu. Učíš sa, skúšaš, rastieš všetko na jednom mieste.
          </p>

          {/* CTA tlačidlo */}
          <div className="flex justify-center">
            <Link
              href="/signup"
              className="
                group relative inline-flex items-center px-12 py-4
                bg-white text-[#7361FF] font-semibold rounded-2xl text-lg
                shadow-xl hover:shadow-[0_8px_30px_rgba(255,255,255,0.25)]
                transition-all duration-400 hover:scale-105
              "
            >
              <span className="relative z-10 flex items-center">
                Začať zadarmo
                <svg
                  className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>

              {/* Glow effect */}
              <span className="absolute -inset-px rounded-2xl bg-white/40 opacity-0 blur-xl group-hover:opacity-40 transition-opacity duration-700" />
            </Link>
          </div>

          {/* Extra info */}
          <div className="flex justify-center gap-10 mt-12 text-white/70 nunito text-sm">
            <div className="flex items-center gap-2"><span>✔</span> Žiadne inštalácie</div>
            <div className="flex items-center gap-2"><span>✔</span> Pre úplných začiatočníkov</div>
            <div className="flex items-center gap-2"><span>✔</span> Všetko v prehliadači</div>
          </div>

        </div>
      </div>
    </section>
  );
}
