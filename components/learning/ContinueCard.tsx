"use client";

import Link from "next/link";

interface ContinueCardProps {
  trackTitle: string;
  lessonTitle: string;
  lessonNumber: number;
  totalLessons: number;
  href: string;
}

export default function ContinueCard({
  trackTitle,
  lessonTitle,
  lessonNumber,
  totalLessons,
  href
}: ContinueCardProps) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-gradient-to-br from-[#7361FF]/5 to-[#8C78FF]/5 p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#7361FF]">
            Pokračuj tam, kde si skončil
          </p>
          <h3 className="mt-2 text-xl font-semibold text-gray-900">
            {trackTitle} – {lessonTitle}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Lekcia {lessonNumber}/{totalLessons}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href={href}
          className="flex-1 rounded-xl bg-gradient-to-r from-[#7361FF] to-[#8C78FF] px-4 py-2.5 text-center text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Pokračovať
        </Link>
        <button className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
          Zopakovať chyby
        </button>
      </div>
    </div>
  );
}
