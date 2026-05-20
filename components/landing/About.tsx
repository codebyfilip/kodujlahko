'use client';

import { HiLightBulb } from 'react-icons/hi';
import { FiCode } from 'react-icons/fi';
import { MdLeaderboard } from 'react-icons/md';

export default function About() {
  const items = [
    {
      icon: <HiLightBulb className="w-8 h-8 text-white" />,
      title: 'Uč sa jednoducho',
      desc: 'Krátke, jasné a pochopiteľné lekcie ťa naučia základy HTML, CSS a JavaScriptu bez chaosu.',
    },
    {
      icon: <FiCode className="w-8 h-8 text-white" />,
      title: 'Precvičuj priamo',
      desc: 'Každú novú vedomosť si vyskúšaš priamo v zabudovanom editore. Vidíš výsledok okamžite.',
    },
    {
      icon: <MdLeaderboard className="w-8 h-8 text-white" />,
      title: 'Získavaj motiváciu',
      desc: 'Za splnené úlohy zbieraš XP, sleduješ progres na rebríčkoch a súťažíš v skupinách.',
    },
  ];

  return (
    <section id="about" className="relative py-16 sm:py-28 bg-linear-to-b from-white to-[#f9f8ff]">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 text-center">

        <h2
          className="text-3xl sm:text-6xl font-semibold text-gray-900 mb-5 sm:mb-10"
          style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
        >
          O projekte
        </h2>

        <p className="text-gray-500 nunito text-base sm:text-xl max-w-3xl mx-auto leading-7 sm:leading-8 mb-10 sm:mb-16">
          KodujĽahko je interaktívna platforma, ktorá ťa naučí tvoriť weby
          od úplných základov. Všetko prebieha <strong>zábavne</strong>,{' '}
          <strong>prehľadne</strong> a <strong>priamo v prehliadači</strong>.
          Bez inštalácií, bez stresu.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-10 mt-6 sm:mt-20">
          {items.map((item, i) => (
            <div
              key={i}
              className="relative flex flex-row sm:flex-col items-center sm:items-center text-left sm:text-center bg-linear-to-br from-[#7361FF] to-[#8C78FF] text-white rounded-3xl p-6 sm:p-10 shadow-[0_8px_25px_rgba(115,97,255,0.3)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(115,97,255,0.4)] overflow-hidden gap-4 sm:gap-0"
            >
              <div className="absolute top-3 right-3 grid grid-cols-3 gap-1.5 opacity-30 pointer-events-none">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <span key={idx} className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                ))}
              </div>

              <div className="shrink-0 sm:mb-5 bg-white/20 backdrop-blur-sm p-3 sm:p-4 rounded-2xl shadow-inner">
                {item.icon}
              </div>

              <div className="flex-1 sm:flex-none">
                <h3
                  className="text-lg sm:text-2xl font-semibold mb-1 sm:mb-3"
                  style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
                >
                  {item.title}
                </h3>
                <p className="text-white/85 leading-relaxed text-sm sm:text-base">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 sm:mt-20 text-gray-700 nunito text-base sm:text-lg font-medium">
          Tvoj prvý web môžeš napísať ešte dnes.{' '}
          <span className="bg-linear-to-r from-[#7361FF] to-[#8C78FF] bg-clip-text text-transparent font-bold">
            Začni jednoducho, koduj ľahko.
          </span>
        </p>

      </div>
    </section>
  );
}
