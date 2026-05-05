'use client';

import { useEffect, useState } from 'react';
import { Users, X, Zap } from 'lucide-react';
import { getGroupLessonDetail, type LessonMemberResult } from '@/app/actions/groups';

interface Props {
  lessonId: string;
  lessonTitle?: string;
  open: boolean;
  onClose: () => void;
}

const STATUS_CONFIG = {
  completed:   { label: 'Dokončené',    color: '#059669', bg: '#F0FDF4', icon: '✓' },
  partial:     { label: 'Rozpracované', color: '#F59E0B', bg: '#FFFBEB', icon: '⚡' },
  not_started: { label: 'Nezačaté',     color: '#9CA3AF', bg: '#F9FAFB', icon: '○' },
};

export default function GroupLessonMenu({ lessonId, lessonTitle, open, onClose }: Props) {
  const [data, setData] = useState<{ groupName: string; members: LessonMemberResult[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getGroupLessonDetail(lessonId)
      .then(res => { setData(res); })
      .catch(() => { setData(null); })
      .finally(() => { setLoading(false); });
  }, [open, lessonId]);

  if (!open) return null;

  const completed = data?.members.filter(m => m.status === 'completed').length ?? 0;
  const total = data?.members.length ?? 0;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(17,17,24,0.35)', backdropFilter: 'blur(3px)',
          animation: 'glmFadeIn 0.18s ease',
        }}
      />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
        width: 340, background: 'white',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        animation: 'glmSlideIn 0.22s cubic-bezier(0.34,1.1,0.64,1)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, #7361FF, #8C78FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Users size={17} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Nunito,sans-serif', fontWeight: 900, fontSize: 15, color: '#111118' }}>
              {data?.groupName ?? 'Skupina'}
            </div>
            {lessonTitle && (
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lessonTitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E8E6F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Progress súhrn */}
        {data && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #F3F4F6', background: '#FAFAFA' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', fontFamily: 'Nunito,sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Postup skupiny
              </span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#7361FF', fontFamily: 'Nunito,sans-serif' }}>
                {completed}/{total} dokončilo
              </span>
            </div>
            <div style={{ height: 5, background: '#E8E6F0', borderRadius: 100, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${total > 0 ? Math.round((completed / total) * 100) : 0}%`,
                background: 'linear-gradient(90deg, #7361FF, #8C78FF)',
                borderRadius: 100, transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        )}

        {/* Členovia */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8, color: '#9CA3AF', fontSize: 13 }}>
              <div style={{ width: 18, height: 18, border: '2px solid #E8E6F0', borderTopColor: '#7361FF', borderRadius: '50%', animation: 'glmSpin 0.7s linear infinite' }} />
              Načítavam…
            </div>
          )}

          {!loading && data?.members.map(member => {
            const cfg = STATUS_CONFIG[member.status];
            return (
              <div key={member.user_id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 20px',
                background: member.isMe ? '#7361FF08' : 'transparent',
                borderLeft: member.isMe ? '3px solid #7361FF' : '3px solid transparent',
              }}>
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
                    <span style={{ fontSize: 13, fontWeight: 700, color: member.isMe ? '#7361FF' : '#111118', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {member.display_name}
                    </span>
                    {member.isMe && <span style={{ fontSize: 10, color: '#7361FF', opacity: 0.7 }}>(ja)</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'Nunito,sans-serif', color: cfg.color, background: cfg.bg, padding: '1px 6px', borderRadius: 100 }}>
                      {cfg.icon} {cfg.label}
                    </span>
                    {member.xp_earned > 0 && (
                      <span style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Zap size={9} style={{ color: '#7361FF' }} />
                        {member.xp_earned} XP
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && (!data || data.members.length === 0) && (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
              Nie si v žiadnej skupine.
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes glmFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes glmSlideIn { from { transform:translateX(100%) } to { transform:translateX(0) } }
        @keyframes glmSpin { to { transform:rotate(360deg) } }
      `}</style>
    </>
  );
}
