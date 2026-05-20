'use client';

import { FiCode, FiZap, FiUsers, FiTrendingUp, FiCpu, FiTarget } from 'react-icons/fi';

const features = [
  {
    icon: <FiCode className="w-5 h-5 sm:w-6 sm:h-6" />,
    title: 'Vstavaný editor',
    desc: 'Píš HTML, CSS a JavaScript priamo v prehliadači. Výsledok vidíš okamžite vedľa kódu bez akýchkoľvek inštalácií.',
    accent: '#7361FF',
  },
  {
    icon: <FiZap className="w-5 h-5 sm:w-6 sm:h-6" />,
    title: 'Interaktívne lekcie',
    desc: 'Každá lekcia je navrhnutá tak, aby ťa viedla krok po kroku. Teória aj prax v jednom mieste.',
    accent: '#8C78FF',
  },
  {
    icon: <FiTrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />,
    title: 'XP a rebríčky',
    desc: 'Za každú splnenú úlohu získavaš XP body. Sleduj svoj postup na rebríčkoch a porovnávaj sa s ostatnými.',
    accent: '#7361FF',
  },
  {
    icon: <FiUsers className="w-5 h-5 sm:w-6 sm:h-6" />,
    title: 'Skupiny',
    desc: 'Uč sa spolu s priateľmi v skupinách. Súťažte medzi sebou, motivujte sa navzájom a rásť spoločne.',
    accent: '#8C78FF',
  },
  {
    icon: <FiCpu className="w-5 h-5 sm:w-6 sm:h-6" />,
    title: 'AI asistent',
    desc: 'Zasekol si sa? AI asistent ti pomôže pochopiť problém a navrhne správny smer bez toho, aby ťa rovno pokazoval riešenie.',
    accent: '#7361FF',
  },
  {
    icon: <FiTarget className="w-5 h-5 sm:w-6 sm:h-6" />,
    title: 'Výzvy',
    desc: 'Prever svoje schopnosti v solo alebo skupinových výzvach. Riešenia, ktoré ťa posunú vpred.',
    accent: '#8C78FF',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-16 sm:py-24 lg:py-32 bg-linear-to-b from-[#f9f8ff] to-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">

        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16 lg:mb-20">
          <span className="inline-block px-4 py-2 bg-[#7361FF]/10 text-[#7361FF] rounded-full text-sm font-semibold mb-4">
            Funkcie platformy
          </span>
          <h2
            className="text-3xl sm:text-5xl font-semibold text-gray-900 mb-4 sm:mb-6"
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          >
            Všetko, čo potrebuješ{' '}
            <span className="bg-linear-to-r from-[#7361FF] to-[#8C78FF] bg-clip-text text-transparent">
              na začiatok
            </span>
          </h2>
          <p className="text-base sm:text-xl text-gray-600 leading-relaxed nunito">
            Žiadne zbytočnosti. Len nástroje, ktoré ti skutočne pomôžu naučiť sa kódovať.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group relative bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-gray-100 shadow-sm hover:shadow-[0_8px_30px_rgba(115,97,255,0.12)] transition-all duration-500 hover:-translate-y-1 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-[#7361FF]/4 rounded-bl-[3rem] sm:rounded-bl-[4rem] pointer-events-none" />

              <div
                className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl mb-4 sm:mb-5 text-white transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: feature.accent }}
              >
                {feature.icon}
              </div>

              <h3
                className="text-base sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3"
                style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
              >
                {feature.title}
              </h3>

              <p className="text-gray-500 nunito leading-relaxed text-sm sm:text-[15px]">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
