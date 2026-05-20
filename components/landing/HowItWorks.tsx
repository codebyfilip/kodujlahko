import { FiBook, FiCode, FiAward, FiArrowRight } from 'react-icons/fi';

export default function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Uč sa',
      description: 'Začni s jednoduchými interaktívnymi lekciami HTML, CSS a JavaScriptu',
      icon: <FiBook className="w-8 h-8 sm:w-10 sm:h-10 text-[#7361FF]" />,
      color: 'from-[#7361FF] to-[#8C78FF]',
      bgColor: 'bg-[#7361FF]/10',
    },
    {
      number: '02',
      title: 'Precvič',
      description: 'Vyskúšaj si všetko priamo v interaktívnom editore a hneď vidíš výsledok svojho kódu.',
      icon: <FiCode className="w-8 h-8 sm:w-10 sm:h-10 text-[#7361FF]" />,
      color: 'from-[#7361FF] to-[#8C78FF]',
      bgColor: 'bg-[#7361FF]/10',
    },
    {
      number: '03',
      title: 'Získavaj body',
      description: 'Za splnené úlohy získavaš XP body, postupuješ na rebríčkoch a súťažíš v skupinách.',
      icon: <FiAward className="w-8 h-8 sm:w-10 sm:h-10 text-[#7361FF]" />,
      color: 'from-[#7361FF] to-[#8C78FF]',
      bgColor: 'bg-[#7361FF]/10',
    },
    {
      number: '04',
      title: 'Postupuj ďalej',
      description: 'Každým krokom sa stávaš lepším vývojárom.',
      icon: <FiArrowRight className="w-8 h-8 sm:w-10 sm:h-10 text-[#7361FF]" />,
      color: 'from-[#7361FF] to-[#8C78FF]',
      bgColor: 'bg-[#7361FF]/10',
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-16 sm:py-24 lg:py-32 px-5 sm:px-6 lg:px-8 bg-linear-to-br from-white to-[#f9f8ff]"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16 lg:mb-20">
          <span className="inline-block px-4 py-2 bg-[#7361FF]/10 text-[#7361FF] rounded-full text-sm font-semibold mb-4">
            Jednoduchý proces
          </span>

          <h2
            className="text-3xl sm:text-5xl font-semibold text-gray-900 mb-4 sm:mb-6"
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          >
            Ako to{' '}
            <span className="bg-linear-to-r from-[#7361FF] to-[#8C78FF] bg-clip-text text-transparent">
              funguje
            </span>
            ?
          </h2>

          <p className="text-base sm:text-xl text-gray-600 leading-relaxed nunito">
            4 jednoduché kroky, ktoré ťa prevedú učením od úplných základov.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-10 pb-8 sm:pb-20">
          {steps.map((step, index) => (
            <div key={index} className="relative group cursor-pointer">
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-20 left-full w-full h-[3px] bg-[#7361FF]/15 -translate-x-1/2 z-0" />
              )}

              <div className="relative z-10 h-full bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-[#7361FF]/10 shadow-md transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(115,97,255,0.18)]">
                <div className={`absolute -top-3 -right-3 sm:-top-4 sm:-right-4 w-9 h-9 sm:w-12 sm:h-12 bg-linear-to-br ${step.color} rounded-xl shadow-lg text-white font-bold text-sm sm:text-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  {step.number}
                </div>

                <div className={`inline-flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 ${step.bgColor} rounded-2xl mb-4 sm:mb-6 backdrop-blur-sm shadow-inner`}>
                  {step.icon}
                </div>

                <h3
                  className="text-base sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-4"
                  style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
                >
                  {step.title}
                </h3>

                <p className="text-gray-600 nunito leading-relaxed text-xs sm:text-base">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
