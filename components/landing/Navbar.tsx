'use client';

import { useState, useEffect } from 'react';
import { Code2, Sparkles, Menu, X, Rocket } from 'lucide-react';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-white/95 backdrop-blur-xl shadow-xl' 
        : 'bg-white/80 backdrop-blur-md shadow-md'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Premium Logo */}
          <a href="#" className="flex items-center space-x-3 group cursor-pointer">
            <div className="relative">
              <div className="w-14 h-14 bg-linear-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300 shadow-xl">
                <Code2 className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
              <div className="absolute -top-1 -right-1 animate-pulse">
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
                KodujĽahko
              </div>
              <div className="text-xs text-gray-500 font-bold -mt-1">.sk</div>
            </div>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-2">
            {['hero', 'about', 'how-it-works', 'features', 'showcase', 'testimonials'].map((section) => (
              <button
                key={section}
                onClick={() => scrollToSection(section)}
                className="px-5 py-2.5 text-gray-700 hover:text-indigo-600 font-semibold transition rounded-xl hover:bg-indigo-50"
              >
                {section === 'hero' && 'Domov'}
                {section === 'about' && 'O projekte'}
                {section === 'how-it-works' && 'Ako to funguje'}
                {section === 'features' && 'Funkcie'}
                {section === 'showcase' && 'Ukážka'}
                {section === 'testimonials' && 'Referencie'}
              </button>
            ))}
            <div className="pl-4">
              <button className="relative px-8 py-3 bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 group overflow-hidden">
                <span className="relative z-10 flex items-center space-x-2">
                  <span>Začni kódiť zadarmo</span>
                  <Rocket className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-linear-to-r from-pink-600 via-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <button 
            className="lg:hidden p-2 rounded-xl hover:bg-indigo-50 transition"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6 text-gray-700" /> : <Menu className="w-6 h-6 text-gray-700" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-6 space-y-2 border-t border-gray-100">
            {[
              { id: 'hero', label: 'Domov' },
              { id: 'about', label: 'O projekte' },
              { id: 'how-it-works', label: 'Ako to funguje' },
              { id: 'features', label: 'Funkcie' },
              { id: 'showcase', label: 'Ukážka' },
              { id: 'testimonials', label: 'Referencie' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="block w-full text-left px-5 py-3 text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl font-semibold transition"
              >
                {item.label}
              </button>
            ))}
            <button className="w-full mt-4 px-6 py-4 bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-xl transition flex items-center justify-center space-x-2">
              <span>Začni kódiť zadarmo</span>
              <Rocket className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}