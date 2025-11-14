'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Hero() {


   const words = [
    { text: 'tvoriť weby', color: '#7361FF' },
    { text: 'HTML', color: '#FF7B00' },
    { text: 'CSS', color: '#007BFF' },
    { text: 'JavaScript', color: '#FFD500' },
  ];

  const [index, setIndex] = useState(0); // aktuálne slovo
  const [subIndex, setSubIndex] = useState(0); // aktuálne písmeno
  const [deleting, setDeleting] = useState(false);
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    // animácia písania
    const interval = setInterval(() => {
      setBlink((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // logika písania / mazania
    const currentWord = words[index].text;

    if (!deleting && subIndex === currentWord.length) {
      // počkaj 10 sekúnd pred mazaním
      const timeout = setTimeout(() => setDeleting(true), 10000);
      return () => clearTimeout(timeout);
    }

    if (deleting && subIndex === 0) {
      // prepnúť na ďalšie slovo
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
      className="relative flex items-center justify-center min-h-screen overflow-hidden bg-linear-to-br from-white to-[#f9f8ff] py-20 sm:py-36"
    >
      {/* Dekoratívne pozadie */}
      <div className="absolute top-20 left-10 w-40 h-40 bg-[#7361FF]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-16 right-10 w-48 h-48 bg-[#8C78FF]/10 rounded-full blur-3xl" />

      {/* Obsah */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10 text-center">
      {/* Nadpis */}
       <h1
          style={{ fontFamily: "'Momo Trust Display', sans-serif" }}
          className="text-4xl sm:text-5xl md:text-[6rem] font-extralight text-gray-900 leading-[1.1] tracking-tight mb-8"
        >
          Najlepšie miesto, kde sa naučíš <br />
          <span
            className="pacifico-regular font-semibold italic drop-shadow-[0_0_10px_rgba(115,97,255,0.25)]"
            style={{ color: words[index].color }}
          >
            {words[index].text.substring(0, subIndex)}
          </span>
         <span
  className={`${
    blink ? 'opacity-100' : 'opacity-0'
  } transition-opacity duration-200   bg-transparent w-[2px] h-[1.1em] inline-block align-middle rounded-full`}
></span>
        </h1>

        {/* Podnadpis */}
        <p className="text-gray-500 nunito text-lg sm:text-lg leading-6 max-w-2xl mx-auto mb-12">
         Nauč sa základy HTML, CSS a JavaScriptu zábavnou formou - krok za krokom, jednoducho a prehľadne, aj bez skúseností s kódovaním.
        </p>

        {/* CTA tlačidlo */}
        <div className="flex justify-center">
  <Link
    href="/signup"
    className="group nunito relative inline-flex items-center justify-center px-10 py-4 overflow-hidden font-semibold text-white text-lg rounded-2xl bg-gradient-to-r from-[#7361FF] to-[#8C78FF] shadow-lg hover:shadow-[0_8px_30px_rgba(115,97,255,0.35)] transition-all duration-500 ease-out hover:scale-[1.04]"
  >
    {/* jemná svetelná vrstva */}
    <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.08] transition-opacity duration-500 rounded-2xl" />

    {/* text */}
    <span className="relative z-10 flex items-center">
      Začať
      {/* šípka s animáciou */}
      <svg
        className="w-5 h-5 ml-2 transition-transform duration-500 group-hover:translate-x-1.5 group-hover:rotate-12"
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

    {/* jemná žiara gradientu pri hover */}
    <span className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[#7361FF] to-[#8C78FF] opacity-0 blur-xl group-hover:opacity-40 transition-opacity duration-700" />
  </Link>
</div>

      </div>
    </section>
  );
}
