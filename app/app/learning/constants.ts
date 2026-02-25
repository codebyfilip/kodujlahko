import { Track } from "./types";

export const TRACKS_DATA: Omit<Track, "progress" | "completedLessons" | "lastLessonTitle">[] = [
  {
    id: "html",
    title: "HTML",
    description: "Základy štruktúry webu. Nadpisy, odkazy, obrázky a semantika.",
    icon: "</>",
    color: "from-orange-500 to-red-500",
    totalLessons: 20,
    href: "/app/learning/html"
  },
  {
    id: "css",
    title: "CSS",
    description: "Dizajn a layout: farby, typografia, flexbox, grid, responzivita.",
    icon: "#",
    color: "from-blue-500 to-cyan-500",
    totalLessons: 25,
    href: "/app/learning/css"
  },
  {
    id: "javascript",
    title: "JavaScript",
    description: "Interaktivita: premenné, DOM, eventy, logika a mini projekty.",
    icon: "⚡",
    color: "from-yellow-500 to-amber-500",
    totalLessons: 30,
    href: "/app/learning/javascript"
  }
];
