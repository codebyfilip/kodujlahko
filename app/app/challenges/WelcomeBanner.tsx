'use client';

import { useEffect, useState } from 'react';
import { X, Swords, Target } from 'lucide-react';

const STORAGE_KEY = 'challenges_welcome_seen';

export default function WelcomeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 14,
      background: '#F5F3FF',
      border: '1px solid #DDD6FE',
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 20,
      fontFamily: 'Inter,sans-serif',
    }}>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginTop: 1 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Target size={16} color="#7C3AED" />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#3B0764', marginBottom: 3 }}>
          Vitaj vo Výzvach
        </div>
        <div style={{ fontSize: 13, color: '#5B21B6', lineHeight: 1.5 }}>
          Vyber si sólo výzvu a precvič si znalosti, alebo vyzvi spoluhráča zo svojej skupiny na súboj.
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#7C3AED', fontWeight: 600 }}>
            <Target size={13} color="#7C3AED" /> Sólo výzvy — rieš úlohy svojím tempom
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#7C3AED', fontWeight: 600 }}>
            <Swords size={13} color="#7C3AED" /> Súboje — súťaž so spoluhráčmi
          </div>
        </div>
      </div>
      <button
        onClick={dismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#A78BFA', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
        aria-label="Zavrieť"
      >
        <X size={15} />
      </button>
    </div>
  );
}
