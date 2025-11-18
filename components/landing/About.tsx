'use client';

import { Lightbulb, Code, Trophy } from 'lucide-react';

export default function About() {
  const items = [
    {
      icon: <Lightbulb className="w-9 h-9 text-white" />,
      title: 'Uč sa jednoducho',
      desc: 'Krátke, jasné a pochopiteľné lekcie ťa naučia základy HTML, CSS a JavaScriptu bez chaosu.',
      shape: 'dots',
    },
    {
      icon: <Code className="w-9 h-9 text-white" />,
      title: 'Precvičuj priamo',
      desc: 'Každú novú vedomosť si vyskúšaš priamo v zabudovanom editore. Vidíš výsledok okamžite.',
      shape: 'dots',
    },
    {
      icon: <Trophy className="w-9 h-9 text-white" />,
      title: 'Získavaj motiváciu',
      desc: 'Za splnené úlohy zbieraš XP, leveluješ a sleduješ svoj progres. Učenie sa mení na hru.',
      shape: 'dots',
    },
  ];

  return (
    <section id="about" className="relative py-28 bg-gradient-to-b from-white to-[#f9f8ff]">
      
      <div className="max-w-6xl mx-auto px-6 text-center">

        {/* Nadpis */}
        <h2 
          className="text-4xl sm:text-6xl font-semibold text-gray-900 mb-10"
          style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
        >
          O projekte
        </h2>

        {/* Popis */}
        <p className="text-gray-500 nunito text-lg sm:text-xl max-w-3xl mx-auto leading-8 mb-16">
          KodujĽahko je interaktívna platforma, ktorá ťa naučí tvoriť weby 
          od úplných základov. Všetko prebieha <strong>zábavne</strong>, 
          <strong>prehľadne</strong> a <strong>priamo v prehliadači</strong>. 
          Bez inštalácií, bez stresu.
        </p>


        {/* BOXY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-20">
          
          {items.map((item, i) => (
            <div 
              key={i}
              className="
                relative flex flex-col items-center text-center 
                bg-gradient-to-br from-[#7361FF] to-[#8C78FF]
                text-white rounded-[2.5rem] p-10 
                shadow-[0_8px_25px_rgba(115,97,255,0.35)]
                transition-all duration-500
                hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(115,97,255,0.45)]
                overflow-hidden
              "
            >
              
              {/* Dekoratívne tvary */}
              {item.shape === 'circles' && (
                <div className="absolute top-4 right-4 w-24 h-24 opacity-30 pointer-events-none">
                  <div className="absolute inset-0 rounded-full border-4 border-white/20"></div>
                  <div className="absolute inset-4 rounded-full border-4 border-white/25"></div>
                  <div className="absolute inset-8 rounded-full border-4 border-white/30"></div>
                </div>
              )}

              {item.shape === 'waves' && (
                <div className="absolute top-0 right-0 w-32 h-24 bg-white/10 rounded-bl-[3rem] [clip-path:polygon(0_0,100%_0,100%_75%,0_100%)] pointer-events-none" />
              )}

              {item.shape === 'dots' && (
                <div className="absolute top-4 right-4 grid grid-cols-4 gap-2 opacity-40 pointer-events-none">
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <span key={idx} className="w-2 h-2 bg-white/40 rounded-full" />
                  ))}
                </div>
              )}

              {/* Ikona */}
              <div className="z-10 mb-6 bg-white/20 backdrop-blur-sm p-4 rounded-2xl shadow-inner hover:scale-110 transition-transform duration-500">
                {item.icon}
              </div>

              {/* Nadpis */}
              <h3 
                className="z-10 text-2xl font-semibold mb-3"
                style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
              >
                {item.title}
              </h3>

              {/* Popis */}
              <p className="z-10 text-white/90 leading-relaxed max-w-xs">
                {item.desc}
              </p>

              {/* Light overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-white/15 opacity-0 hover:opacity-100 transition-opacity duration-700 rounded-[2.5rem]" />

            </div>
          ))}
        </div>


        {/* Záver */}
        <p className="mt-20 text-gray-700 nunito text-lg font-medium">
          Tvoj prvý web môžeš napísať ešte dnes. <br />
          <span className="bg-gradient-to-r from-[#7361FF] to-[#8C78FF] bg-clip-text text-transparent font-bold">
            Začni jednoducho, koduj ľahko.
          </span>
        </p>

      </div>
    </section>
  );
}
