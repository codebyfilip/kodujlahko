"use client";

import Link from "next/link";

interface DrillCardProps {
  title: string;
  description: string;
  icon: string;
  duration: string;
  href: string;
}

export default function DrillCard({
  title,
  description,
  icon,
  duration,
  href
}: DrillCardProps) {
  return (
    <Link href={href} className="group block">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-[1px]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 text-lg transition-transform duration-200 group-hover:scale-110">
            {icon}
          </div>
          <span className="text-xs font-medium text-gray-400">{duration}</span>
        </div>

        <h4 className="mb-1 text-sm font-semibold text-gray-900">{title}</h4>
        <p className="text-xs text-gray-500">{description}</p>

        <div className="mt-4">
          <span className="text-xs font-medium text-[#7361FF] group-hover:underline">
            Začať drill →
          </span>
        </div>
      </div>
    </Link>
  );
}
