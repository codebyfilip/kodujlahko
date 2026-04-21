'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DayData {
  label: string;
  fullDate: string;
  xp: number;
  lessons: number;
}

interface Props {
  dailyData: DayData[];
  weekXP: number;
  weekLessons: number;
  streak: number | null;
}

type Mode = 'xp' | 'lessons';

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: DayData }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#1E1B4B', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontFamily: 'Inter,sans-serif' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{d.fullDate}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
        {d.xp > 0 ? `${d.xp} XP` : '–'}{d.lessons > 0 ? ` · ${d.lessons} ${d.lessons === 1 ? 'lekcia' : 'lekcie'}` : ''}
      </div>
    </div>
  );
}

export default function WeeklyStatsCard({ dailyData, weekXP, weekLessons, streak }: Props) {
  const [mode, setMode] = useState<Mode>('xp');

  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 6);
  const rangeLabel = `${from.getDate()}.${from.getMonth() + 1}. – ${today.getDate()}.${today.getMonth() + 1}.`;

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16, padding: 20, fontFamily: 'Inter,sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Tento týždeň</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{rangeLabel}</div>
        </div>
        {/* Toggle XP / Lekcie */}
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 2, gap: 2 }}>
          {(['xp', 'lessons'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#7C3AED' : '#94A3B8', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all .15s' }}
            >
              {m === 'xp' ? 'XP' : 'Lekcie'}
            </button>
          ))}
        </div>
      </div>

      {/* Štatistiky */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, background: '#F5F3FF', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>XP</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{weekXP}</div>
        </div>
        <div style={{ flex: 1, background: '#F0FDF4', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Lekcie</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{weekLessons}</div>
        </div>
        {streak != null && streak > 0 && (
          <div style={{ flex: 1, background: '#FFF7ED', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Streak</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{streak}</div>
          </div>
        )}
      </div>

      {/* Graf */}
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={dailyData} barSize={22} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#94A3B8', fontFamily: 'Inter,sans-serif' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F5F3FF', radius: 6 }} />
          <Bar dataKey={mode} radius={[5, 5, 3, 3]}>
            {dailyData.map((entry, i) => {
              const isToday = i === dailyData.length - 1;
              const hasData = entry[mode] > 0;
              return (
                <Cell
                  key={i}
                  fill={isToday && hasData ? '#7C3AED' : hasData ? '#C4B5FD' : '#E2E8F0'}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
