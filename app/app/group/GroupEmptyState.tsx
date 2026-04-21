'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Zap, Trophy, Flame, BarChart3, ArrowRight, Hash, Globe, Lock, UserPlus, ChevronDown, ChevronUp, ScrollText } from 'lucide-react';
import { joinGroup, joinPublicGroup } from '@/app/actions/groups';
import type { PublicGroupEntry } from '@/app/actions/groups';

interface Props {
  prefillCode?: string | null;
  publicGroups: PublicGroupEntry[];
}

type Tab = 'public' | 'code' | 'create';

export default function GroupEmptyState({ prefillCode, publicGroups }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(prefillCode ? 'code' : publicGroups.length > 0 ? 'public' : 'code');
  const [code, setCode] = useState(prefillCode ?? '');
  const [joining, setJoining] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleJoinCode(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase().replace(/\s/g, '');
    if (trimmed.length !== 6) { setError('Kód musí mať presne 6 znakov.'); return; }
    setError('');
    setJoining(true);
    const result = await joinGroup(trimmed);
    setJoining(false);
    if (result.error) { setError(result.error); }
    else { setSuccess(true); setTimeout(() => router.refresh(), 1200); }
  }

  async function handleJoinPublic(groupId: string) {
    setJoiningId(groupId);
    setError('');
    const result = await joinPublicGroup(groupId);
    setJoiningId(null);
    if (result.error) { setError(result.error); }
    else { setSuccess(true); setTimeout(() => router.refresh(), 1200); }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    ...(publicGroups.length > 0 ? [{ id: 'public' as Tab, label: 'Verejné skupiny', icon: <Globe size={14} /> }] : []),
    { id: 'code', label: 'Pripojiť kódom', icon: <Hash size={14} /> },
    { id: 'create', label: 'Vytvoriť', icon: <Users size={14} /> },
  ];

  return (
    <>
      {success && (
        <div style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 999, background: 'linear-gradient(135deg, #059669, #10B981)', color: 'white', borderRadius: 16, padding: '14px 22px', boxShadow: '0 8px 32px rgba(16,185,129,0.35)', fontFamily: 'Nunito,sans-serif', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeInUp 0.35s ease both' }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          Úspešne si sa pripojil do skupiny!
          <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}`}</style>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5" style={{ background: 'linear-gradient(135deg, #7361FF15, #8C78FF25)' }}>
            <Users size={30} style={{ color: '#7361FF' }} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Uč sa spolu s ostatnými</h1>
          <p className="text-gray-500 text-base leading-relaxed max-w-md mx-auto">
            Skupiny ti umožňujú sledovať progres kamarátov, porovnávať XP a motivovať sa navzájom.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-6" style={{ background: '#F3F4F6' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(''); }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all cursor-pointer"
              style={tab === t.id
                ? { background: 'white', color: '#7361FF', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }
                : { color: '#6B7280', background: 'transparent' }
              }
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Verejné skupiny */}
        {tab === 'public' && (
          <div className="flex flex-col gap-3">
            {publicGroups.length === 0 && (
              <div className="rounded-2xl border border-gray-100 p-10 text-center text-sm text-gray-400">
                Momentálne nie sú žiadne verejné skupiny.
              </div>
            )}
            {publicGroups.map(g => {
              const isExpanded = expandedId === g.id;
              const hasDetails = g.description || g.rules;
              return (
                <div key={g.id} className="rounded-2xl border bg-white overflow-hidden transition-all" style={{ borderColor: isExpanded ? '#C4B5FD' : '#E5E7EB' }}>
                  {/* Hlavička karty */}
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg, #7361FF, #8C78FF)' }}>
                      {g.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-gray-900 text-sm truncate">{g.name}</span>
                        <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                          <Users size={11} /> {g.member_count}/{g.max_members}
                        </span>
                      </div>
                      {g.description && !isExpanded && (
                        <p className="text-xs text-gray-400 truncate">{g.description}</p>
                      )}
                      <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: '#E8E6F0' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.round((g.member_count / g.max_members) * 100)}%`, background: 'linear-gradient(90deg, #7361FF, #8C78FF)' }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {hasDetails && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : g.id)}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-all"
                          style={{ background: isExpanded ? '#F5F3FF' : '#F9FAFB', color: isExpanded ? '#7361FF' : '#6B7280', border: `1px solid ${isExpanded ? '#C4B5FD' : '#E5E7EB'}` }}
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          Info
                        </button>
                      )}
                      <button
                        onClick={() => handleJoinPublic(g.id)}
                        disabled={joiningId === g.id}
                        className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-semibold text-white transition-all disabled:opacity-50 cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #7361FF, #8C78FF)' }}
                      >
                        <UserPlus size={13} />
                        {joiningId === g.id ? 'Pripájam…' : 'Pripojiť'}
                      </button>
                    </div>
                  </div>

                  {/* Expandovaný detail */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #F3F4F6', background: '#FAFAFA', padding: '16px 20px' }}>
                      {g.description && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9CA3AF' }}>Popis</p>
                          <p className="text-sm text-gray-600 leading-relaxed">{g.description}</p>
                        </div>
                      )}
                      {g.rules && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: '#9CA3AF' }}>
                            <ScrollText size={11} /> Pravidlá
                          </p>
                          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                            {g.rules}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>}
          </div>
        )}

        {/* Tab: Kód */}
        {tab === 'code' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-1">
              <Lock size={16} style={{ color: '#7361FF' }} />
              <span className="font-semibold text-gray-900 text-sm">Pripojiť sa cez kód</span>
            </div>
            <p className="text-xs text-gray-400 mb-5">Zadaj 6-znakový kód, ktorý ti poslal zakladateľ skupiny.</p>
            <form onSubmit={handleJoinCode} className="flex flex-col gap-3">
              <input
                type="text"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase().replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, '').slice(0, 6)); setError(''); }}
                placeholder="XXXXXX"
                maxLength={6}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-xl font-mono tracking-[0.3em] text-gray-900 outline-none transition focus:border-[#7361FF] focus:ring-2 focus:ring-[#7361FF]/10"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={joining || code.trim().length === 0}
                className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #7361FF, #8C78FF)' }}
              >
                {joining ? 'Pripájam…' : <><ArrowRight size={15} /> Pripojiť sa</>}
              </button>
            </form>
          </div>
        )}

        {/* Tab: Vytvoriť */}
        {tab === 'create' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-1">
              <Users size={16} style={{ color: '#7361FF' }} />
              <span className="font-semibold text-gray-900 text-sm">Vytvoriť skupinu</span>
            </div>
            <p className="text-xs text-gray-400 mb-6">Nastav typ skupiny podľa toho, kto sa môže pripojiť.</p>

            {/* Group type explanation */}
            <div className="flex flex-col gap-3 mb-6">
              {[
                {
                  icon: <Globe size={16} style={{ color: '#059669' }} />,
                  label: 'Verejná',
                  desc: 'Viditeľná pre všetkých. Ktokoľvek sa môže pripojiť priamo zo zoznamu bez kódu.',
                  bg: '#F0FDF4', border: '#A7F3D0',
                },
                {
                  icon: <Lock size={16} style={{ color: '#7361FF' }} />,
                  label: 'Len pozvaní (kód)',
                  desc: 'Skrytá. Pripojiť sa dá iba pomocou 6-znakového kódu, ktorý zdieľaš sám.',
                  bg: '#F5F3FF', border: '#C4B5FD',
                },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3 rounded-xl p-3.5" style={{ background: item.bg, border: `1.5px solid ${item.border}` }}>
                  <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-0.5">{item.label}</div>
                    <div className="text-xs text-gray-500 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/app/group/create"
              className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #7361FF, #8C78FF)' }}
            >
              Vytvoriť skupinu
              <ArrowRight size={15} />
            </Link>
          </div>
        )}

        {/* Benefity */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5 mt-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Čo získaš v skupine</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <Zap size={14} />, text: 'Porovnaj XP s kamarátmi' },
              { icon: <Trophy size={14} />, text: 'Leaderboard skupiny' },
              { icon: <Flame size={14} />, text: 'Sleduj streaky ostatných' },
              { icon: <BarChart3 size={14} />, text: 'Progres skupiny v lekciách' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span style={{ color: '#7361FF' }}>{item.icon}</span>
                <span className="text-sm text-gray-600">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
