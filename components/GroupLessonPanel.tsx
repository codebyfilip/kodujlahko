'use client';

import { useEffect, useState } from 'react';
import { Users, CheckCircle, Clock, Zap } from 'lucide-react';
import { getMyGroup } from '@/app/actions/groups';
import { getGroupLessonStats } from '@/app/actions/groups';

interface Stats {
  fullCount: number;
  partialCount: number;
  notStarted: number;
  totalMembers: number;
}

interface Props {
  lessonId: string;
}

export default function GroupLessonPanel({ lessonId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { membership } = await getMyGroup();
      if (!membership || cancelled) { setLoading(false); return; }
      setGroupName(membership.group.name);
      const s = await getGroupLessonStats(membership.group_id, lessonId);
      if (!cancelled) { setStats(s); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [lessonId]);

  if (loading || !stats || !groupName) return null;

  const { fullCount, partialCount, notStarted, totalMembers } = stats;
  if (totalMembers === 0) return null;

  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 20,
        borderTop: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Users size={13} style={{ color: '#7361FF', flexShrink: 0 }} />
        <span style={{ fontFamily: 'Nunito,sans-serif', fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Skupina
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {fullCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={13} style={{ color: '#10B981', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
              {fullCount} z {totalMembers} dokončilo
            </span>
          </div>
        )}
        {partialCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={13} style={{ color: '#F59E0B', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
              {partialCount} práve rieši
            </span>
          </div>
        )}
        {notStarted > 0 && fullCount === 0 && partialCount === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={13} style={{ color: '#9CA3AF', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              {totalMembers} ešte nezačalo
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 10, height: 4, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${totalMembers > 0 ? Math.round((fullCount / totalMembers) * 100) : 0}%`,
          background: 'linear-gradient(90deg, #7361FF, #8C78FF)',
          borderRadius: 100,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: '#9CA3AF', fontFamily: 'Nunito,sans-serif', fontWeight: 700 }}>
        {totalMembers > 0 ? Math.round((fullCount / totalMembers) * 100) : 0}% skupiny dokončilo túto lekciu
      </div>
    </div>
  );
}
