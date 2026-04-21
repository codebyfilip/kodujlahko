'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Flame, Zap, Crown, LogOut, Check, AlertTriangle, Hash, Link2, Globe, Lock, Settings } from 'lucide-react';
import { leaveGroup } from '@/app/actions/groups';
import type { GroupRow, MembershipRow } from '@/app/actions/groups';
import GroupSettingsPanel from './GroupSettingsPanel';

interface LeaderboardEntry {
  user_id: string;
  group_id: string;
  display_name?: string | null;
  email?: string | null;
  total_xp: number;
  weekly_xp?: number | null;
  current_streak?: number | null;
}

interface Props {
  membership: MembershipRow & { group: GroupRow };
  currentUserId: string;
  leaderboard: LeaderboardEntry[];
}

function memberName(entry: LeaderboardEntry): string {
  return entry.display_name || entry.email?.split('@')[0] || 'Neznámy';
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function GroupDashboard({ membership, currentUserId, leaderboard }: Props) {
  const router = useRouter();
  const group = membership.group;
  const isOwner = membership.role === 'owner';

  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [showLeave, setShowLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const myEntry = leaderboard.find(m => m.user_id === currentUserId);

  function copyCode() {
    navigator.clipboard.writeText(group.join_code);
    setCopied('code');
    setTimeout(() => setCopied(null), 2000);
  }

  function copyLink() {
    const url = `${window.location.origin}/app/group?code=${group.join_code}`;
    navigator.clipboard.writeText(url);
    setCopied('link');
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleLeave() {
    setLeaving(true);
    setLeaveError('');
    const res = await leaveGroup(group.id);
    setLeaving(false);
    if (res.error) { setLeaveError(res.error); setShowLeave(false); }
    else router.refresh();
  }

  return (
    <>
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isOwner && <Crown size={16} style={{ color: '#F59E0B' }} />}
              <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            </div>

            {/* Typ skupiny badge */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {group.type === 'public' && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: '#F0FDF4', color: '#059669', border: '1px solid #A7F3D0' }}>
                  <Globe size={10} /> Verejná
                </span>
              )}
              {group.type === 'invite_only' && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: '#F5F3FF', color: '#7361FF', border: '1px solid #C4B5FD' }}>
                  <Lock size={10} /> Len pozvaní
                </span>
              )}
            </div>

            {group.description && (
              <p className="text-sm text-gray-500 mt-1.5 max-w-md">{group.description}</p>
            )}
          </div>

          {/* Akcie v headeri */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {/* Kód skupiny */}
            <button
              onClick={copyCode}
              title="Kopírovať kód skupiny"
              className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer"
              style={copied === 'code'
                ? { background: '#ECFDF5', color: '#059669', border: '2px solid #6EE7B7' }
                : { background: 'linear-gradient(135deg, #7361FF, #8C78FF)', color: 'white', border: '2px solid transparent', boxShadow: '0 4px 14px rgba(115,97,255,0.3)' }
              }
            >
              {copied === 'code'
                ? <><Check size={14} /><span>Skopírované!</span></>
                : <><Hash size={14} /><span className="font-mono tracking-widest">{group.join_code}</span></>
              }
            </button>

            {/* Invite link */}
            <button
              onClick={copyLink}
              title="Kopírovať pozývací link"
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer"
              style={copied === 'link'
                ? { background: '#ECFDF5', color: '#059669', border: '2px solid #6EE7B7' }
                : { background: 'white', color: '#7361FF', border: '2px solid #7361FF' }
              }
            >
              {copied === 'link'
                ? <><Check size={14} /><span>Skopírované!</span></>
                : <><Link2 size={14} /><span>Link</span></>
              }
            </button>

            {/* Settings (len owner) */}
            {isOwner && (
              <button
                onClick={() => setShowSettings(true)}
                title="Nastavenia skupiny"
                className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all cursor-pointer"
                style={{ background: '#F9FAFB', color: '#374151', border: '2px solid #E5E7EB' }}
              >
                <Settings size={15} />
                Nastavenia
              </button>
            )}
          </div>
        </div>

        {/* Moje štatistiky */}
        {myEntry && (
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: 'linear-gradient(135deg, #7361FF08, #8C78FF12)', border: '1px solid #7361FF20' }}
          >
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Tvoje štatistiky
            </p>
            <div className="flex gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Zap size={15} style={{ color: '#7361FF' }} />
                <span className="font-bold text-gray-900">{myEntry.total_xp} XP</span>
                <span className="text-xs text-gray-400">celkovo</span>
              </div>
              {myEntry.weekly_xp != null && (
                <div className="flex items-center gap-2">
                  <Trophy size={15} style={{ color: '#F59E0B' }} />
                  <span className="font-bold text-gray-900">{myEntry.weekly_xp} XP</span>
                  <span className="text-xs text-gray-400">tento týždeň</span>
                </div>
              )}
              {myEntry.current_streak != null && (
                <div className="flex items-center gap-2">
                  <Flame size={15} style={{ color: '#EF4444' }} />
                  <span className="font-bold text-gray-900">{myEntry.current_streak}</span>
                  <span className="text-xs text-gray-400">dní streak</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="rounded-2xl border border-gray-200 bg-white mb-6">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Trophy size={15} style={{ color: '#7361FF' }} />
            <span className="font-semibold text-gray-900 text-sm">Leaderboard skupiny</span>
            <span className="ml-auto text-xs text-gray-400">{leaderboard.length} členov</span>
          </div>

          <div className="divide-y divide-gray-50">
            {leaderboard.map((entry, idx) => {
              const isMe = entry.user_id === currentUserId;
              const name = memberName(entry);
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 px-5 py-3.5 ${isMe ? 'bg-[#7361FF]/5' : ''}`}
                >
                  <span className="w-7 text-center flex-shrink-0">
                    {idx < 3
                      ? <span className="text-lg">{MEDALS[idx]}</span>
                      : <span className="text-sm font-bold text-gray-400">{idx + 1}</span>
                    }
                  </span>

                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #7361FF, #8C78FF)' }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold truncate ${isMe ? 'text-[#7361FF]' : 'text-gray-900'}`}>
                        {name}
                      </span>
                      {isMe && <span className="text-xs text-[#7361FF]/70">(ja)</span>}
                      {entry.user_id === group.owner_id && !isMe && (
                        <Crown size={11} style={{ color: '#F59E0B', flexShrink: 0 }} />
                      )}
                    </div>
                    {entry.current_streak != null && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Flame size={10} style={{ color: '#EF4444' }} />
                        <span className="text-xs text-gray-400">{entry.current_streak} dní streak</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-gray-900">{entry.total_xp} XP</div>
                    {entry.weekly_xp != null && (
                      <div className="text-xs text-gray-400">+{entry.weekly_xp} týždeň</div>
                    )}
                  </div>
                </div>
              );
            })}

            {leaderboard.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                Zatiaľ žiadne dáta. Začnite sa učiť!
              </div>
            )}
          </div>
        </div>

        {/* Pravidlá */}
        {group.rules && (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Pravidlá skupiny
            </p>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{group.rules}</p>
          </div>
        )}

        {/* Spodné akcie (len opustenie pre non-owner) */}
        {!isOwner && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowLeave(true)}
              className="flex items-center gap-2 rounded-xl border-2 border-red-200 px-4 py-2.5 text-sm font-semibold text-red-500 transition-all hover:bg-red-50 cursor-pointer"
            >
              <LogOut size={14} />
              Opustiť skupinu
            </button>
          </div>
        )}

        {leaveError && (
          <p className="mt-3 text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{leaveError}</p>
        )}

        {/* Confirm leave modal */}
        {showLeave && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setShowLeave(false)}
          >
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} style={{ color: '#EF4444' }} />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Opustiť skupinu?</p>
                  <p className="text-sm text-gray-500">Táto akcia sa nedá vrátiť.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleLeave}
                  disabled={leaving}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white bg-red-500 disabled:opacity-50 cursor-pointer"
                >
                  {leaving ? 'Odchádzam…' : 'Áno, opustiť'}
                </button>
                <button onClick={() => setShowLeave(false)} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 cursor-pointer">
                  Zrušiť
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings panel (owner only) */}
      {isOwner && (
        <GroupSettingsPanel
          open={showSettings}
          onClose={() => setShowSettings(false)}
          membership={membership}
          currentUserId={currentUserId}
          members={leaderboard}
        />
      )}
    </>
  );
}
