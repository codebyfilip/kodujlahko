'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function getCtaHref() {
  if (typeof document === 'undefined') return '/signup';
  const visited = document.cookie.split(';').some(c => c.trim().startsWith('kl_visited='));
  return visited ? '/login' : '/signup';
}

export default function Hero() {
  const words = [
    { text: 'tvoriť weby', color: '#7361FF' },
    { text: 'HTML', color: '#FF7B00' },
    { text: 'CSS', color: '#007BFF' },
    { text: 'JavaScript', color: '#ffbf00' },
  ];

  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [blink, setBlink] = useState(true);
  const [ctaHref, setCtaHref] = useState('/signup');

  useEffect(() => {
    const href = getCtaHref();
    setCtaHref(href);
    if (href === '/signup') {
      document.cookie = 'kl_visited=1; max-age=31536000; path=/; SameSite=Lax';
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setBlink((prev) => !prev), 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const currentWord = words[index].text;
    if (!deleting && subIndex === currentWord.length) {
      const timeout = setTimeout(() => setDeleting(true), 10000);
      return () => clearTimeout(timeout);
    }
    if (deleting && subIndex === 0) {
      setDeleting(false);
      setIndex((prev) => (prev + 1) % words.length);
      return;
    }
    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (deleting ? -1 : 1));
    }, deleting ? 70 : 110);
    return () => clearTimeout(timeout);
  }, [subIndex, deleting, index]);

  return (
    <section
      id="home"
      className="relative flex items-center justify-center min-h-screen overflow-hidden bg-linear-to-br from-white to-[#f9f8ff] py-28 sm:py-36"
    >
      <div className="absolute top-20 left-6 sm:left-10 w-28 sm:w-40 h-28 sm:h-40 bg-[#7361FF]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-16 right-6 sm:right-10 w-36 sm:w-48 h-36 sm:h-48 bg-[#8C78FF]/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-6 py-8 text-center">
        <h1
          style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          className="text-[2rem] sm:text-5xl md:text-[6rem] font-extralight text-gray-900 leading-[1.15] tracking-tight mb-5 sm:mb-8"
        >
          Najlepšie miesto,{' '}
          <span className="inline sm:hidden"><br /></span>
          kde sa naučíš{' '}
          <span className="hidden sm:inline"><br /></span>
          <span
            className="pacifico-regular font-semibold italic drop-shadow-[0_0_10px_rgba(115,97,255,0.25)]"
            style={{ color: words[index].color }}
          >
            {words[index].text.substring(0, subIndex)}
          </span>
          <span
            className={`${blink ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200 bg-transparent w-0.5 h-[1.1em] inline-block align-middle rounded-full`}
          />
        </h1>

        <p className="text-gray-500 nunito text-base sm:text-lg leading-6 sm:leading-7 max-w-2xl mx-auto mb-8 sm:mb-12 px-2">
          Začni sa učiť základy HTML, CSS a JavaScriptu zábavnou formou ľahko a prehľadne, aj bez skúseností s kódovaním.
        </p>

        <div className="flex justify-center px-6 sm:px-0">
          <Link
            href={ctaHref}
            className="group nunito relative inline-flex items-center justify-center w-full sm:w-auto px-10 py-4 overflow-hidden font-semibold text-white text-base sm:text-lg rounded-2xl bg-linear-to-r from-[#7361FF] to-[#8C78FF] shadow-lg hover:shadow-[0_8px_30px_rgba(115,97,255,0.35)] transition-all duration-500 ease-out hover:scale-[1.04] active:scale-[0.98]"
          >
            <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity duration-500 rounded-2xl" />
            <span className="relative z-10 flex items-center gap-2">
              Začať zadarmo
              <svg
                className="w-5 h-5 transition-transform duration-500 group-hover:translate-x-1.5 group-hover:-rotate-12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
