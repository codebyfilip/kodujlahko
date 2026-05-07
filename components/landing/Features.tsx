'use client';

import { FiCode, FiZap, FiUsers, FiTrendingUp, FiCpu, FiTarget } from 'react-icons/fi';

const features = [
  {
    icon: <FiCode className="w-6 h-6" />,
    title: 'Vstavaný editor',
    desc: 'Píš HTML, CSS a JavaScript priamo v prehliadači. Výsledok vidíš okamžite vedľa kódu bez akýchkoľvek inštalácií.',
    accent: '#7361FF',
  },
  {
    icon: <FiZap className="w-6 h-6" />,
    title: 'Interaktívne lekcie',
    desc: 'Každá lekcia je navrhnutá tak, aby ťa viedla krok po kroku. Teória aj prax v jednom mieste.',
    accent: '#8C78FF',
  },
  {
    icon: <FiTrendingUp className="w-6 h-6" />,
    title: 'XP a rebríčky',
    desc: 'Za každú splnenú úlohu získavaš XP body. Sleduj svoj postup na rebríčkoch a porovnávaj sa s ostatnými.',
    accent: '#7361FF',
  },
  {
    icon: <FiUsers className="w-6 h-6" />,
    title: 'Skupiny',
    desc: 'Uč sa spolu s priateľmi v skupinách. Súťažte medzi sebou, motivujte sa navzájom a rásť spoločne.',
    accent: '#8C78FF',
  },
  {
    icon: <FiCpu className="w-6 h-6" />,
    title: 'AI asistent',
    desc: 'Zasekol si sa? AI asistent ti pomôže pochopiť problém, vysvetlí kód a navrhne správny smer bez toho, aby ťa rovno pokazoval riešenie.',
    accent: '#7361FF',
  },
  {
    icon: <FiTarget className="w-6 h-6" />,
    title: 'Výzvy',
    desc: 'Prever svoje schopnosti v solo alebo skupinových výzvach. Riešenia, ktoré ťa posunú vpred.',
    accent: '#8C78FF',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 sm:py-32 bg-linear-to-b from-[#f9f8ff] to-white">
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <span className="inline-block px-4 py-2 bg-[#7361FF]/10 text-[#7361FF] rounded-full text-sm font-semibold mb-4">
            Funkcie platformy
          </span>
          <h2
            className="text-4xl sm:text-5xl font-semibold text-gray-900 mb-6"
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          >
            Všetko, čo potrebuješ{' '}
            <span className="bg-linear-to-r from-[#7361FF] to-[#8C78FF] bg-clip-text text-transparent">
              na začiatok
            </span>

          </h2>
          <p className="text-xl text-gray-600 leading-relaxed nunito">
            Žiadne zbytočnosti. Len nástroje, ktoré ti skutočne pomôžu naučiť sa kódovať.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group relative bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-[0_8px_30px_rgba(115,97,255,0.12)] transition-all duration-500 hover:-translate-y-1 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#7361FF]/4 rounded-bl-[4rem] pointer-events-none" />

              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-5 text-white transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: feature.accent }}
              >
                {feature.icon}
              </div>

              <h3
                className="text-xl font-semibold text-gray-900 mb-3"
                style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
              >
                {feature.title}
              </h3>

              <p className="text-gray-500 nunito leading-relaxed text-[15px]">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
