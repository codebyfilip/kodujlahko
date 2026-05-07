'use client';

import { useState } from 'react';
import { FiChevronRight, FiX, FiBookOpen, FiGlobe, FiLayers, FiCode, FiUsers, FiLayout, FiZap } from 'react-icons/fi';
import { markOnboardingDone } from '@/app/actions/onboarding';

interface Props { name: string; }

const STEPS = [
  {
    Icon: FiBookOpen,
    title: (name: string) => `Vitaj, ${name}`,
    subtitle: 'KódujĽahko ťa naučí kódovať od základov interaktívne, krok za krokom.',
    content: null,
  },
  {
    Icon: FiGlobe,
    title: () => 'Tri kurzy, jeden cieľ',
    subtitle: 'Každá lekcia má vysvetlenie, príklady a kvíz na overenie znalostí.',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '20px 0' }}>
        {[
          { Icon: FiGlobe,  name: 'HTML',       desc: 'Základ každej webstránky - štruktúra a obsah',  color: '#DC2626', bg: '#FFF4F0', border: '#FECACA' },
          { Icon: FiLayers, name: 'CSS',         desc: 'Štýl, farby a animácie - ako web vyzerá',       color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
          { Icon: FiCode,   name: 'JavaScript',  desc: 'Logika a interaktivita - web ktorý žije',       color: '#059669', bg: '#F0FDF4', border: '#A7F3D0' },
        ].map(c => (
          <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: c.bg, border: `1px solid ${c.border}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <c.Icon size={18} color={c.color} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{c.name}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>{c.desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    Icon: FiUsers,
    title: () => 'Uč sa s kamarátmi',
    subtitle: 'Vytvor skupinu alebo sa pridaj k existujúcej. Súťažte kto má vyššie XP a dlhší streak.',
    content: (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '20px 0' }}>
        {[
          { Icon: FiZap,    text: 'Porovnaj XP' },
          { Icon: FiLayout, text: 'Sleduj streak' },
          { Icon: FiUsers,  text: 'Leaderboard' },
          { Icon: FiBookOpen, text: 'Progres skupiny' },
        ].map(item => (
          <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
            <item.Icon size={15} color="#7C3AED" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#5B21B6' }}>{item.text}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    Icon: FiLayout,
    title: () => 'Tvoj domov',
    subtitle: 'Na tejto stránke vždy uvidíš kde si skončil, tvoje XP, postup skupiny a čo môžeš zlepšiť.',
    content: (
      <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { Icon: FiBookOpen, text: 'Pokračuj tam kde si skončil' },
          { Icon: FiZap,      text: 'Sleduj svoje XP a streak' },
          { Icon: FiUsers,    text: 'Vidíš postup svojej skupiny' },
          { Icon: FiLayout,   text: 'Zistíš čo môžeš zlepšiť' },
        ].map(item => (
          <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
            <item.Icon size={14} color="#7C3AED" />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#5B21B6' }}>{item.text}</span>
          </div>
        ))}
      </div>
    ),
  },
];

export default function HomeOnboarding({ name }: Props) {
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  async function finish() {
    setClosing(true);
    await markOnboardingDone();
  }

  if (closing) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(124,58,237,0.2)', overflow: 'hidden', fontFamily: 'Inter,sans-serif' }}>

        {/* Progress bar */}
        <div style={{ height: 4, background: '#EDE9FE' }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg,#7C3AED,#A855F7)', width: `${((step + 1) / STEPS.length) * 100}%`, transition: 'width 0.35s ease', borderRadius: 100 }} />
        </div>

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#7C3AED,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(124,58,237,0.3)' }}>
              <current.Icon size={24} color="#fff" />
            </div>
            <button
              onClick={finish}
              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #EDE9FE', background: '#F5F3FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED' }}
            >
              <FiX size={14} />
            </button>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.4px', lineHeight: 1.25 }}>
            {current.title(name)}
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.65, margin: 0 }}>
            {current.subtitle}
          </p>

          {current.content}

          {/* Nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: current.content ? 0 : 24 }}>
            {/* Dots */}
            <div style={{ display: 'flex', gap: 5 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 100, background: i === step ? '#7C3AED' : '#DDD6FE', transition: 'all 0.3s' }} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #DDD6FE', background: '#F5F3FF', color: '#7C3AED', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Späť
                </button>
              )}
              <button
                onClick={isLast ? finish : () => setStep(s => s + 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#A855F7)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}
              >
                {isLast ? 'Začať !' : <><span>Ďalej</span><FiChevronRight size={15} /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
