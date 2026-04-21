'use client';

import Image from 'next/image';

interface WeekBucket {
  label: string;
  xp: number;
  lessons: number;
}

interface Props {
  name: string;
  avatar: string | null;
  totalPct: number;
  totalXP: number;
  streak: number | null;
  weeklyData: WeekBucket[];
}

const CIRCUMFERENCE = 2 * Math.PI * 52; // r=52

export default function HomeStats({ name, avatar, totalPct, totalXP, streak, weeklyData }: Props) {
  const pct = Math.min(100, Math.max(0, totalPct));
  const dash = (pct / 100) * CIRCUMFERENCE;
  const maxXP = Math.max(...weeklyData.map(w => w.xp), 1);
  const maxBar = weeklyData.reduce((a, b) => b.xp > a.xp ? b : a, weeklyData[0]);

  return (
    <div style={{
      background: 'white',
      border: '1.5px solid #E8E6F0',
      borderRadius: 24,
      padding: '28px 28px 24px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Ľavá časť: avatar ring + info ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, minWidth: 140 }}>

          {/* SVG progress ring + avatar */}
          <div style={{ position: 'relative', width: 120, height: 120 }}>
            <svg width={120} height={120} style={{ position: 'absolute', top: 0, left: 0 }}>
              {/* Track */}
              <circle
                cx={60} cy={60} r={52}
                fill="none" stroke="#EDE9FF" strokeWidth={7}
              />
              {/* Progress */}
              <circle
                cx={60} cy={60} r={52}
                fill="none"
                stroke="url(#ringGrad)"
                strokeWidth={7}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dasharray 0.8s ease' }}
              />
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7361FF" />
                  <stop offset="100%" stopColor="#8C78FF" />
                </linearGradient>
              </defs>
            </svg>

            {/* Avatar */}
            <div style={{
              position: 'absolute', top: 10, left: 10,
              width: 100, height: 100, borderRadius: '50%',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #7361FF, #8C78FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {avatar ? (
                <Image
                  src={avatar}
                  alt={name}
                  width={100} height={100}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                  unoptimized
                />
              ) : (
                <span style={{ fontSize: 36, fontWeight: 900, color: 'white', fontFamily: 'Nunito,sans-serif' }}>
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Percent badge */}
            {pct > 0 && (
              <div style={{
                position: 'absolute', top: 2, right: 2,
                background: 'linear-gradient(135deg, #7361FF, #8C78FF)',
                color: 'white', borderRadius: 100,
                padding: '3px 8px', fontSize: 11, fontWeight: 800,
                fontFamily: 'Nunito,sans-serif',
                boxShadow: '0 2px 8px rgba(115,97,255,0.4)',
                whiteSpace: 'nowrap',
              }}>
                {pct}%
              </div>
            )}
          </div>

          {/* Meno + pozdrav */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 900, fontSize: 17, color: '#111118' }}>
              {greeting()} {name.split(' ')[0]}
              {streak != null && streak > 1 && <span style={{ marginLeft: 6 }}>🔥</span>}
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>
              Pokračuj v učení!
            </div>
          </div>

          {/* Mini stats */}
          <div style={{ display: 'flex', gap: 12 }}>
            <Pill icon="⚡" value={`${totalXP}`} label="XP" />
            {streak != null && <Pill icon="🔥" value={`${streak}`} label="dní" />}
          </div>
        </div>

        {/* ── Pravá časť: bar chart ── */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 13, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            Aktivita — XP za týždeň
          </div>

          {weeklyData.every(w => w.xp === 0) ? (
            <div style={{ fontSize: 13, color: '#9CA3AF', padding: '20px 0' }}>
              Ešte nemáš žiadnu aktivitu. Začni sa učiť! 🚀
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 110 }}>
              {weeklyData.map((week, i) => {
                const isMax = week === maxBar && week.xp > 0;
                const barH = week.xp === 0 ? 6 : Math.max(12, Math.round((week.xp / maxXP) * 90));
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    {/* XP label nad barom */}
                    {week.xp > 0 && (
                      <div style={{ fontSize: 10, fontWeight: 800, color: isMax ? '#7361FF' : '#9CA3AF', fontFamily: 'Nunito,sans-serif' }}>
                        {week.xp}
                      </div>
                    )}
                    {/* Bar */}
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%',
                        height: barH,
                        borderRadius: '8px 8px 4px 4px',
                        background: isMax
                          ? 'linear-gradient(180deg, #7361FF, #8C78FF)'
                          : week.xp > 0 ? '#C4B5FD' : '#F3F4F6',
                        transition: 'height 0.5s ease',
                        boxShadow: isMax ? '0 4px 14px rgba(115,97,255,0.3)' : 'none',
                      }} />
                    </div>
                    {/* Label */}
                    <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                      {week.label}
                    </div>
                    {/* Lekcie pod labelom */}
                    {week.lessons > 0 && (
                      <div style={{ fontSize: 9, color: '#C4B5FD', fontWeight: 700, fontFamily: 'Nunito,sans-serif' }}>
                        {week.lessons}×
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F5F3FF', borderRadius: 10, padding: '5px 10px' }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 13, color: '#7361FF' }}>{value}</span>
      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</span>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Dobré ráno,';
  if (h < 18) return 'Dobrý deň,';
  return 'Dobrý večer,';
}
