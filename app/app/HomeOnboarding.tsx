'use client';

import { useState } from 'react';
import { ChevronRight, X, BookOpen, Globe, Palette, Code2, Users, LayoutDashboard, Zap } from 'lucide-react';
import { markOnboardingDone } from '@/app/actions/onboarding';

interface Props { name: string; }

const STEPS = [
  {
    Icon: BookOpen,
    title: (name: string) => `Vitaj, ${name}`,
    subtitle: 'KóduLahko ta nauci programovat od zakladov — interaktivne, krok za krokom.',
    content: null,
  },
  {
    Icon: Globe,
    title: () => 'Tri kurzy, jeden ciel',
    subtitle: 'Kazda lekcia ma vysvetlenie, priklady a kviz na overenie znalosti.',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '20px 0' }}>
        {[
          { Icon: Globe,   name: 'HTML',       desc: 'Zaklad kazde webstranky — struktura a obsah',  color: '#DC2626', bg: '#FFF4F0', border: '#FECACA' },
          { Icon: Palette, name: 'CSS',         desc: 'Styl, farby, animacie — ako web vypzera',      color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
          { Icon: Code2,   name: 'JavaScript',  desc: 'Logika a interaktivita — web ktory zije',     color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
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
    Icon: Users,
    title: () => 'Skupiny — uc sa s kamaratmi',
    subtitle: 'Vytvor skupinu alebo sa pridaj k existujucej. Sutazte kto ma vyssi XP a dlhsi streak.',
    content: (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '20px 0' }}>
        {[
          { Icon: Zap,             text: 'Porovnaj XP' },
          { Icon: LayoutDashboard, text: 'Sleduj streak' },
          { Icon: Users,           text: 'Leaderboard' },
          { Icon: BookOpen,        text: 'Progres skupiny' },
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
    Icon: LayoutDashboard,
    title: () => 'Tvoj domov',
    subtitle: 'Na tejto stranke vzdy uvidis kde si skoncil, tvoje XP, postup skupiny a co mozes zlepsit.',
    content: (
      <div style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { Icon: BookOpen,  text: 'Pokracuj tam kde si skoncil' },
          { Icon: Zap,       text: 'Sleduj svoje XP a streak' },
          { Icon: Users,     text: 'Vidis postup svojej skupiny' },
          { Icon: LayoutDashboard, text: 'Zistis co mozes zlepsit' },
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
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px rgba(0,0,0,0.15)', overflow: 'hidden', fontFamily: 'Inter,sans-serif' }}>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#F1F5F9' }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg,#7C3AED,#6D28D9)', width: `${((step + 1) / STEPS.length) * 100}%`, transition: 'width 0.35s ease', borderRadius: 100 }} />
        </div>

        <div style={{ padding: '24px 24px 20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F5F3FF', border: '1px solid #DDD6FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <current.Icon size={22} color="#7C3AED" />
            </div>
            <button
              onClick={finish}
              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}
            >
              <X size={14} />
            </button>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.3px', lineHeight: 1.25 }}>
            {current.title(name)}
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, margin: 0 }}>
            {current.subtitle}
          </p>

          {current.content}

          {/* Nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: current.content ? 0 : 24 }}>
            {/* Dots */}
            <div style={{ display: 'flex', gap: 5 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 100, background: i === step ? '#7C3AED' : '#E2E8F0', transition: 'all 0.3s' }} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Spat
                </button>
              )}
              <button
                onClick={isLast ? finish : () => setStep(s => s + 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}
              >
                {isLast ? 'Zacat!' : <><span>Dalej</span><ChevronRight size={15} /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
