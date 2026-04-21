'use client';

import { useState } from 'react';
import { Users, X, Zap, Trophy } from 'lucide-react';
import { getGroupCourseProgress, type MemberCourseProgress } from '@/app/actions/groups';

interface Props {
  courseSlug: string;
  totalLessons: number;
}

export default function GroupTrackPanel({ courseSlug, totalLessons }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ groupName: string; members: MemberCourseProgress[] } | null>(null);

  function handleOpen() {
    setOpen(true);
    if (!data) {
      setLoading(true);
      getGroupCourseProgress(courseSlug).then(res => {
        setData(res);
        setLoading(false);
      });
    }
  }

  function handleClose() {
    setOpen(false);
  }

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <>
      <button
        onClick={handleOpen}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg, #7361FF, #8C78FF)',
          color: 'white', border: 'none', borderRadius: 10,
          padding: '7px 14px', fontSize: 13, fontWeight: 700,
          fontFamily: 'Nunito,sans-serif', cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(115,97,255,0.3)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(115,97,255,0.4)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 10px rgba(115,97,255,0.3)'; }}
      >
        <Users size={14} />
        Skupina
      </button>

      {open && (
        <>
          <div
            onClick={handleClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(17,17,24,0.35)', backdropFilter: 'blur(3px)',
              animation: 'gtpFadeIn 0.18s ease',
            }}
          />

          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
            width: 360, background: 'white',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column',
            animation: 'gtpSlideIn 0.22s cubic-bezier(0.34,1.1,0.64,1)',
          }}>
            {/* Header */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, #7361FF, #8C78FF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Trophy size={18} color="white" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 900, fontSize: 15, color: '#111118' }}>
                  {data?.groupName ?? 'Skupina'}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                  Postup v kurze — {totalLessons} lekcií
                </div>
              </div>
              <button
                onClick={handleClose}
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E8E6F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Members list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 8, color: '#9CA3AF', fontSize: 13 }}>
                  <div style={{ width: 18, height: 18, border: '2px solid #E8E6F0', borderTopColor: '#7361FF', borderRadius: '50%', animation: 'gtpSpin 0.7s linear infinite' }} />
                  Načítavam…
                </div>
              )}

              {!loading && data?.members.map((member, idx) => {
                const pct = totalLessons > 0 ? Math.round((member.completed_count / totalLessons) * 100) : 0;
                const medal = medals[idx] ?? null;

                return (
                  <div key={member.user_id} style={{
                    padding: '14px 20px',
                    background: member.is_me ? '#7361FF08' : 'transparent',
                    borderLeft: member.is_me ? '3px solid #7361FF' : '3px solid transparent',
                    borderBottom: '1px solid #F9FAFB',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, #7361FF, #8C78FF)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800, color: 'white',
                      }}>
                        {member.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {medal && <span style={{ fontSize: 14 }}>{medal}</span>}
                          <span style={{ fontSize: 13, fontWeight: 700, color: member.is_me ? '#7361FF' : '#111118', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {member.display_name}
                          </span>
                          {member.is_me && <span style={{ fontSize: 10, color: '#7361FF', opacity: 0.7 }}>(ja)</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Nunito,sans-serif', color: '#374151' }}>
                            {member.completed_count}/{totalLessons} lekcií
                          </span>
                          {member.xp_earned > 0 && (
                            <span style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Zap size={9} style={{ color: '#7361FF' }} />
                              {member.xp_earned} XP
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'Nunito,sans-serif', color: pct === 100 ? '#059669' : '#7361FF' }}>
                        {pct}%
                      </span>
                    </div>
                    <div style={{ height: 5, background: '#E8E6F0', borderRadius: 100, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: pct === 100
                          ? 'linear-gradient(90deg, #10B981, #34D399)'
                          : 'linear-gradient(90deg, #7361FF, #8C78FF)',
                        borderRadius: 100,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                );
              })}

              {!loading && (!data || data.members.length === 0) && (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 6, fontFamily: 'Nunito,sans-serif' }}>
                    Nie si v žiadnej skupine
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                    Pripoj sa k skupine a sleduj postup ostatných
                  </div>
                </div>
              )}
            </div>
          </div>

          <style>{`
            @keyframes gtpFadeIn { from { opacity:0 } to { opacity:1 } }
            @keyframes gtpSlideIn { from { transform:translateX(100%) } to { transform:translateX(0) } }
            @keyframes gtpSpin { to { transform:rotate(360deg) } }
          `}</style>
        </>
      )}
    </>
  );
}
