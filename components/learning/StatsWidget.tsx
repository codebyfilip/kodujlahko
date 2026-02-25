"use client";

interface StatsWidgetProps {
  streak: number;
  xp: number;
}

export default function StatsWidget({ streak, xp }: StatsWidgetProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Streak */}
      <div className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 px-4 py-2">
        <span className="text-xl">🔥</span>
        <div>
          <p className="text-xs text-gray-500">Streak</p>
          <p className="text-sm font-semibold text-gray-900">{streak} dní</p>
        </div>
      </div>

      {/* XP */}
      <div className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 px-4 py-2">
        <span className="text-xl">⭐</span>
        <div>
          <p className="text-xs text-gray-500">XP</p>
          <p className="text-sm font-semibold text-gray-900">{xp.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
