"use client";

import Link from "next/link";
import { Code2, Braces, Zap } from "lucide-react";
import { Track, TrackId } from "./types";

interface TrackCardProps {
  track: Track;
}

type TrackKey = TrackId;

const stylesByTrack: Record<
  TrackKey,
  {
    accentFrom: string;
    accentTo: string;
    softBgFrom: string;
    softBgTo: string;
    ringFrom: string;
    ringTo: string;
    Icon: React.ElementType;
    badge: string;
  }
> = {
  html: {
    accentFrom: "from-orange-500",
    accentTo: "to-amber-500",
    softBgFrom: "from-orange-50",
    softBgTo: "to-amber-50",
    ringFrom: "from-orange-400/70",
    ringTo: "to-amber-400/70",
    Icon: Code2,
    badge: "HTML",
  },
  css: {
    accentFrom: "from-blue-500",
    accentTo: "to-cyan-500",
    softBgFrom: "from-blue-50",
    softBgTo: "to-cyan-50",
    ringFrom: "from-blue-400/70",
    ringTo: "to-cyan-400/70",
    Icon: Braces,
    badge: "CSS",
  },
  javascript: {
    accentFrom: "from-yellow-400",
    accentTo: "to-amber-400",
    softBgFrom: "from-yellow-50",
    softBgTo: "to-amber-50",
    ringFrom: "from-yellow-300/80",
    ringTo: "to-amber-300/80",
    Icon: Zap,
    badge: "JS",
  },
};

function clampProgress(p: number) {
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(100, p));
}

export default function TrackCard({ track }: TrackCardProps) {
  const hasProgress = (track.progress ?? 0) > 0;
  const progress = clampProgress(track.progress ?? 0);

  // fallback ak track.id nie je presne "html/css/javascript"
  const key = (track.id as TrackKey) ?? "html";
  const s = stylesByTrack[key] ?? stylesByTrack.html;
  const Icon = s.Icon;

  return (
    <Link href={track.href} className="group block">
      <div className="relative">
        {/* Premium hover ring */}
        <div
          className={[
            "absolute -inset-[1px] rounded-3xl opacity-0 blur-[2px] transition-all duration-300",
            "group-hover:opacity-100",
            "bg-linear-to-r",
            s.ringFrom,
            s.ringTo,
          ].join(" ")}
        />

        {/* Card */}
        <div className="relative rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 group-hover:-translate-y-[2px] group-hover:shadow-md">
          {/* Top row: badge + subtle progress */}
          <div className="mb-5 flex items-center justify-between">
            <span
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                "bg-white",
                "border-gray-100 text-gray-700",
              ].join(" ")}
            >
              <span
                className={[
                  "h-2 w-2 rounded-full bg-linear-to-r",
                  s.accentFrom,
                  s.accentTo,
                ].join(" ")}
              />
              {s.badge}
            </span>

            {hasProgress ? (
              <span className="text-xs font-medium text-gray-500">
                {track.completedLessons}/{track.totalLessons} •{" "}
                <span className="text-gray-900">{progress}%</span>
              </span>
            ) : (
              <span className="text-xs text-gray-400">
                {track.totalLessons} lekcií
              </span>
            )}
          </div>

          {/* Icon + Title */}
          <div className="mb-3 flex items-center gap-3">
            <div
              className={[
                "flex h-12 w-12 items-center justify-center rounded-2xl border",
                "bg-gradient-to-br",
                s.softBgFrom,
                s.softBgTo,
                "border-gray-100",
                "transition-transform duration-300 group-hover:scale-[1.06]",
              ].join(" ")}
            >
              <Icon className="h-6 w-6 text-gray-900" />
            </div>

            <h3 className="text-xl font-semibold text-gray-900">
              {track.title}
            </h3>
          </div>

          {/* Description */}
          <p className="mb-5 text-sm leading-relaxed text-gray-600">
            {track.description}
          </p>

          {/* Progress bar */}
          {hasProgress && (
            <div className="mb-5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={[
                    "h-full rounded-full bg-linear-to-r transition-all duration-500",
                    s.accentFrom,
                    s.accentTo,
                  ].join(" ")}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {track.lastLessonTitle && (
                <div className="mt-3 text-xs text-gray-400">
                  Naposledy: <span className="text-gray-600">{track.lastLessonTitle}</span>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="mt-2">
            {hasProgress ? (
              /* Progress-fill tlačidlo */
              <div className="relative w-full overflow-hidden rounded-2xl bg-gray-100 py-3 text-sm font-semibold">
                {/* Farebná výplň podľa % progressu */}
                <div
                  className={[
                    "absolute inset-y-0 left-0 bg-linear-to-r transition-all duration-500",
                    s.accentFrom,
                    s.accentTo,
                  ].join(" ")}
                  style={{ width: `${progress}%` }}
                />
                {/* Text vždy na popredí */}
                <span className="relative z-10 flex items-center justify-center gap-1.5 text-gray-900">
                  Pokračovať
                  <span className="font-bold">({progress}%)</span>
                  <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
                </span>
              </div>
            ) : (
              /* Plné tlačidlo — nezačatý kurz */
              <div
                className={[
                  "flex w-full items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-sm font-semibold",
                  "text-white transition-all duration-300 bg-linear-to-r",
                  s.accentFrom,
                  s.accentTo,
                  "group-hover:opacity-95",
                ].join(" ")}
              >
                Začať
                <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
              </div>
            )}
          </div>

          {/* subtle bottom line */}
          <div className="mt-5 h-px w-full bg-linear-to-r from-transparent via-gray-100 to-transparent" />
        </div>
      </div>
    </Link>
  );
}
