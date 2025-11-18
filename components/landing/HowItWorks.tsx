/**
 * HowItWorks Component
 * Upravené pre dizajn KodujĽahko – fialový brand + moderný feel
 */
export default function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Uč sa',
      description:
        'Začni s jednoduchými interaktívnymi lekciami HTML, CSS a JavaScriptu',
      icon: '📚',
      color: 'from-[#7361FF] to-[#8C78FF]',
      bgColor: 'bg-[#7361FF]/10',
    },
    {
      number: '02',
      title: 'Precvič',
      description:
        'Vyskúšaj si všetko priamo v interaktívnom editore a hneď vidíš výsledok svojho kódu.',
      icon: '⚙️',
      color: 'from-[#7361FF] to-[#8C78FF]',
      bgColor: 'bg-[#7361FF]/10',
    },
    {
      number: '03',
      title: 'Získavaj body',
      description:
        'Za splnené úlohy získavaš XP body, levely a odznaky',
      icon: '🏆',
      color: 'from-[#7361FF] to-[#8C78FF]',
      bgColor: 'bg-[#7361FF]/10',
    },
   {
  number: '04',
  title: 'Postupuj ďalej',
  description:
    'Každým krokom sa stávaš lepším vývojárom.',
  icon: '🚀',
  color: 'from-[#7361FF] to-[#8C78FF]',
  bgColor: 'bg-[#7361FF]/10',
}
  ];

  return (
    <section
      id="how-it-works"
      className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-linear-to-br from-white to-[#f9f8ff]"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <span className="inline-block px-4 py-2 bg-[#7361FF]/10 text-[#7361FF] rounded-full text-sm font-semibold mb-4">
            Jednoduchý proces
          </span>

          <h2
            className="text-4xl sm:text-5xl font-semibold text-gray-900 mb-6"
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          >
            Ako to{' '}
            <span className="bg-gradient-to-r from-[#7361FF] to-[#8C78FF] bg-clip-text text-transparent">
              funguje
            </span>
            ?
          </h2>

          <p className="text-xl text-gray-600 leading-relaxed nunito">
            4 jednoduché kroky, ktoré ťa prevedú učením od úplných základov.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 pb-20">
          {steps.map((step, index) => (
            <div key={index} className="relative group cursor-pointer">
              {/* Connecting line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-20 left-full w-full h-[3px] bg-[#7361FF]/15 -translate-x-1/2 z-0"></div>
              )}

              {/* Card */}
              <div
                className="
                  relative z-10 h-full bg-white rounded-3xl p-8 
                  border border-[#7361FF]/10 shadow-lg
                  transition-all duration-500 hover:-translate-y-2 
                  hover:shadow-[0_10px_30px_rgba(115,97,255,0.18)]
                "
              >
                {/* Number Badge */}
                <div
                  className={`
                    absolute -top-4 -right-4 w-12 h-12 
                    bg-gradient-to-br ${step.color}
                    rounded-xl shadow-lg text-white font-bold text-lg 
                    flex items-center justify-center 
                    group-hover:scale-110 transition-transform
                  `}
                >
                  {step.number}
                </div>

                {/* Icon */}
                <div
                  className={`
                    inline-flex items-center justify-center w-20 h-20 
                    ${step.bgColor} rounded-2xl mb-6 
                    backdrop-blur-sm shadow-inner
                     transition-transform
                  `}
                >
                  <span className="text-5xl">{step.icon}</span>
                </div>

                {/* Content */}
                <h3
                  className="text-2xl font-semibold text-gray-900 mb-4"
                  style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
                >
                  {step.title}
                </h3>

                <p className="text-gray-600 nunito leading-relaxed">
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
