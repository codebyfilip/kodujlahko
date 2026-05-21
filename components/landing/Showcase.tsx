'use client';

import { useState } from 'react';
import { FiPlay, FiCode, FiEye, FiChevronRight } from 'react-icons/fi';

const TABS = ['HTML', 'CSS', 'JavaScript'] as const;
type Tab = typeof TABS[number];

const examples: Record<Tab, { code: string; preview: string }> = {
  HTML: {
    code: `<h1>Ahoj, svet!</h1>
<p>Toto je môj prvý web.</p>
<button>Klikni na mňa</button>`,
    preview: `<div style="font-family:sans-serif;padding:24px;background:#fff;border-radius:12px">
  <h1 style="color:#1a1a1a;margin:0 0 8px">Ahoj, svet!</h1>
  <p style="color:#555;margin:0 0 16px">Toto je môj prvý web.</p>
  <button style="background:#7361FF;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px">Klikni na mňa</button>
</div>`,
  },
  CSS: {
    code: `.karta {
  background: #7361FF;
  color: white;
  padding: 24px;
  border-radius: 16px;
  text-align: center;
  font-size: 20px;
}`,
    preview: `<div style="padding:24px">
  <div style="background:#7361FF;color:white;padding:24px;border-radius:16px;text-align:center;font-size:20px;font-family:sans-serif">
    Toto je moja karta
  </div>
</div>`,
  },
  JavaScript: {
    code: `let skore = 0;

function pridajBod() {
  skore = skore + 1;
  document.getElementById('skore')
    .innerText = skore;
}`,
    preview: `<div style="font-family:sans-serif;padding:24px;text-align:center">
  <p style="font-size:18px;color:#555">Skóre: <strong id="s" style="color:#7361FF;font-size:24px">0</strong></p>
  <button onclick="document.getElementById('s').innerText=parseInt(document.getElementById('s').innerText)+1" style="background:#7361FF;color:#fff;border:none;padding:12px 28px;border-radius:10px;cursor:pointer;font-size:16px">Pridaj bod</button>
</div>`,
  },
};

export default function Showcase() {
  const [activeTab, setActiveTab] = useState<Tab>('HTML');
  const [showCode, setShowCode] = useState(true);

  const ex = examples[activeTab];

  return (
    <section id="showcase" className="py-16 sm:py-24 lg:py-32 bg-linear-to-b from-white to-[#f9f8ff]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
          <span className="inline-block px-4 py-2 bg-[#7361FF]/10 text-[#7361FF] rounded-full text-sm font-semibold mb-4">
            Ukážka editora
          </span>
          <h2
            className="text-3xl sm:text-5xl font-semibold text-gray-900 mb-4 sm:mb-6"
            style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          >
            Vyskúšaj to{' '}
            <span className="bg-linear-to-r from-[#7361FF] to-[#8C78FF] bg-clip-text text-transparent">
              hneď teraz
            </span>
          </h2>
          <p className="text-base sm:text-xl text-gray-600 leading-relaxed nunito">
            Takto vyzerá editor priamo v KodujĽahko. Kód na ľavo, výsledok na pravo.
          </p>
        </div>

        {/* Editor */}
        <div className="max-w-5xl mx-auto rounded-3xl sm:rounded-4xl overflow-hidden shadow-[0_20px_60px_rgba(115,97,255,0.18)] border border-[#7361FF]/10">

          {/* Titlebar */}
          <div className="bg-[#1e1e2e] px-4 sm:px-6 py-3 sm:py-4">
            {/* Mobile: tabs + toggle on separate rows */}
            <div className="flex items-center justify-between sm:hidden">
              <div className="flex gap-1 bg-[#2a2a3e] rounded-xl p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                      activeTab === tab ? 'bg-[#7361FF] text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 bg-[#2a2a3e] rounded-xl p-1">
                <button
                  onClick={() => setShowCode(true)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${showCode ? 'bg-[#7361FF] text-white' : 'text-gray-400'}`}
                >
                  <FiCode className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setShowCode(false)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${!showCode ? 'bg-[#7361FF] text-white' : 'text-gray-400'}`}
                >
                  <FiEye className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Desktop: original layout */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <span className="w-3 h-3 rounded-full bg-[#28C840]" />
              </div>
              <div className="flex gap-1 bg-[#2a2a3e] rounded-xl p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                      activeTab === tab ? 'bg-[#7361FF] text-white shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 bg-[#2a2a3e] rounded-xl p-1">
                <button
                  onClick={() => setShowCode(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${showCode ? 'bg-[#7361FF] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <FiCode className="w-3.5 h-3.5" /> Kód
                </button>
                <button
                  onClick={() => setShowCode(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${!showCode ? 'bg-[#7361FF] text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <FiEye className="w-3.5 h-3.5" /> Náhľad
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-[#13131f] min-h-60 sm:min-h-80">
            {showCode ? (
              <div className="flex">
                <div className="select-none px-3 sm:px-4 py-4 sm:py-6 text-right text-gray-600 text-xs sm:text-sm font-mono leading-6 sm:leading-7 border-r border-white/5 min-w-10">
                  {ex.code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                </div>
                <pre className="flex-1 px-4 sm:px-6 py-4 sm:py-6 text-xs sm:text-sm font-mono text-gray-200 leading-6 sm:leading-7 overflow-x-auto whitespace-pre">
                  {ex.code}
                </pre>
              </div>
            ) : (
              <div className="p-4 sm:p-6">
                <div
                  className="bg-white rounded-xl overflow-hidden min-h-48 sm:min-h-65"
                  dangerouslySetInnerHTML={{ __html: ex.preview }}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-[#1e1e2e] px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
            <span className="text-gray-500 text-xs font-mono flex items-center gap-2">
              <FiPlay className="w-3 h-3 text-[#7361FF]" />
              KodujĽahko Editor
            </span>
            <span className="text-gray-500 text-xs">
              {activeTab} · {ex.code.split('\n').length} riadkov
            </span>
          </div>
        </div>

        {/* CTA pod editorom */}
        <div className="mt-8 sm:mt-12 text-center px-4 sm:px-0">
          <p className="text-gray-500 nunito mb-4 sm:mb-5 text-sm sm:text-base">
            Toto je len ukážka. V skutočnej platforme máš plný interaktívny editor s AI asistentom.
          </p>
          <a
            href="/signup"
            className="inline-flex items-center gap-2 w-full sm:w-auto justify-center px-8 py-3.5 bg-linear-to-r from-[#7361FF] to-[#8C78FF] text-white font-semibold rounded-2xl shadow-lg hover:shadow-[0_8px_25px_rgba(115,97,255,0.35)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 nunito"
          >
            Začať zadarmo <FiChevronRight className="w-5 h-5" />
          </a>
        </div>

      </div>
    </section>
  );
}
