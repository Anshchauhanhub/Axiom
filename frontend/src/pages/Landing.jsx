import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight, BrainCircuit, Zap, Target,
  MessageSquare, Video, CheckCircle, Shield,
  Sparkles, Globe, Menu, X
} from 'lucide-react';
import RoadmapVisual from '../components/RoadmapVisual';

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: <Target className="text-primary" size={32} />,
      title: "Learning Architect",
      description: "Direct dialogue with our high-accountability coach to build granular, high-mastery roadmaps tailored to your pace."
    },
    {
      icon: <Video className="text-secondary" size={32} />,
      title: "Smart Import",
      description: "Transform any public YouTube playlist into a structured learning module with AI-generated subtopics and goals."
    },
    {
      icon: <Target className="text-primary" size={32} />,
      title: "Verified Mastery",
      description: "Validate your knowledge with AI-driven assessments. Move forward only when you've truly mastered the concepts."
    },
    {
      icon: <Zap className="text-secondary" size={32} />,
      title: "Precision Nudges",
      description: "Stay consistent with Telegram-integrated reminders and status updates synchronized with your study schedule."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0e0e10] text-on-surface selection:bg-primary/30 overflow-x-hidden">
      {/* ─── Navigation ─── */}
      <nav className={`fixed top-0 left-0 w-full z-[100] transition-all duration-500 ${isScrolled
          ? 'bg-[#0e0e10]/90 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] border-b border-outline-variant/10'
          : 'bg-gradient-to-b from-[#0e0e10]/80 to-transparent border-b border-transparent'
        }`}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 flex items-center justify-between h-20 sm:h-24">

          {/* Logo */}
          <Link to="/" className="relative flex items-center group shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img
                src="/logo.png"
                alt="Edxiom"
                className="w-auto h-12 sm:h-14 lg:h-16 relative z-10 transition-transform duration-500 group-hover:scale-110"
              />
            </div>
          </Link>

          {/* Center Nav Links (Desktop) */}
          <div className="hidden lg:flex items-center gap-12">
            <a href="#features" className="text-[10px] font-label font-black uppercase tracking-[0.3em] text-on-surface-variant/50 hover:text-primary transition-all duration-300 relative group/nav">
              Features
              <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-primary group-hover/nav:w-full transition-all duration-300" />
            </a>
            <a href="#how-it-works" className="text-[10px] font-label font-black uppercase tracking-[0.3em] text-on-surface-variant/50 hover:text-primary transition-all duration-300 relative group/nav">
              How it works
              <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-primary group-hover/nav:w-full transition-all duration-300" />
            </a>
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/login" className="px-6 py-2.5 rounded-full bg-white/5 border border-white/5 text-on-surface-variant font-label font-black text-[9px] uppercase tracking-[0.2em] hover:bg-white/10 hover:border-primary/20 hover:text-primary transition-all duration-300">
              Sign In
            </Link>
            <Link to="/register" className="px-8 py-2.5 bg-primary text-black rounded-full font-label font-black text-[9px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(253,184,19,0.3)] hover:shadow-[0_0_40px_rgba(253,184,19,0.6)] hover:scale-[1.05] active:scale-[0.95] transition-all duration-300">
              Get Started
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden text-on-surface p-2 rounded-xl hover:bg-white/5 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        <div className={`md:hidden overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}>
          <div className="bg-[#0e0e10]/98 backdrop-blur-2xl border-t border-outline-variant/10 px-6 py-6 space-y-3">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-label font-bold uppercase tracking-[0.15em] text-on-surface-variant hover:text-primary transition-colors py-3 border-b border-outline-variant/5">
              Features
            </a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-label font-bold uppercase tracking-[0.15em] text-on-surface-variant hover:text-primary transition-colors py-3 border-b border-outline-variant/5">
              How it works
            </a>
            <div className="pt-4 flex flex-col gap-3">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3.5 rounded-xl border border-outline-variant/20 text-on-surface-variant font-label font-bold text-[11px] uppercase tracking-widest hover:border-primary/40 hover:text-primary transition-all text-center">
                Sign In
              </Link>
              <Link to="/register" onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3.5 bg-primary text-on-primary-container rounded-xl font-label font-bold text-[11px] uppercase tracking-widest hover:shadow-lg hover:shadow-primary/20 transition-all text-center">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative pt-32 pb-16 lg:pt-40 lg:pb-28 overflow-hidden">
        {/* Ambient */}
        <div className="absolute inset-0 edxiom-grid opacity-[0.03] -z-10"></div>
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/8 rounded-full blur-[200px] -z-10"></div>
        <div className="absolute bottom-[-100px] right-[-200px] w-[600px] h-[400px] bg-secondary/5 rounded-full blur-[150px] -z-10"></div>

        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 grid lg:grid-cols-[1fr_1fr] gap-8 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="z-10 order-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/15 bg-primary/5 mb-8">
              <Sparkles size={14} className="text-primary" />
              <span className="text-[10px] font-label font-bold uppercase tracking-[0.2em] text-primary/80">AI-Powered Learning</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black font-headline uppercase tracking-tighter leading-[0.92] mb-6">
              Master Your <span className="text-primary italic">Focus</span>.<br />
              Architect Your <span className="text-secondary italic">Future</span>.
            </h1>
            <p className="text-base sm:text-lg text-on-surface-variant/70 font-light leading-relaxed mb-10 max-w-lg">
              Edxiom is a high-accountability learning ecosystem. We transform fragmented content into structured mastery paths using world-class AI coaching.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/register" className="px-8 py-4 bg-primary text-on-primary-container rounded-full font-label font-bold text-xs uppercase tracking-[0.2em] hover:scale-[1.03] active:scale-[0.97] transition-all shadow-[0_10px_40px_rgba(253,184,19,0.25)] flex items-center justify-center gap-3">
                Begin Your Path <ArrowRight size={16} />
              </Link>
              <a href="#features" className="px-8 py-4 bg-white/[0.03] border border-outline-variant/15 text-on-surface rounded-full font-label font-bold text-xs uppercase tracking-[0.2em] hover:bg-white/[0.06] hover:border-outline-variant/25 transition-all flex items-center justify-center">
                Explore Features
              </a>
            </div>
          </div>

          {/* Right: Visual */}
          <div className="relative order-2 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 blur-[80px] -z-10"></div>
            <RoadmapVisual />
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section id="features" className="py-20 lg:py-32 relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px] -z-10"></div>

        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="text-center mb-16 lg:mb-20 max-w-2xl mx-auto">
            <span className="inline-block text-[10px] font-label font-bold uppercase tracking-[0.3em] text-primary/60 mb-4">Core Capabilities</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black font-headline uppercase tracking-tighter mb-5 leading-tight">
              Built for High <span className="text-primary">Performance</span>
            </h2>
            <p className="text-on-surface-variant/60 font-light text-base sm:text-lg">
              Traditional learning is broken by cognitive overload. Edxiom fixes it with precision architecture.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-16">
            {features.map((f, i) => (
              <div
                key={i}
                className="group relative transition-all duration-700 hover:-translate-y-2"
              >
                {/* Hover glow - borderless */}
                <div className="absolute inset-[-2rem] rounded-[3rem] bg-primary/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl"></div>

                <div className="relative">
                  <div className="w-16 h-16 flex items-center justify-center mb-8 group-hover:scale-125 transition-transform duration-700">
                    {React.cloneElement(f.icon, { size: 40, className: `transition-all duration-500 ${i % 2 === 0 ? 'text-primary' : 'text-secondary'} drop-shadow-[0_0_15px_rgba(253,184,19,0.3)]` })}
                  </div>
                  <h3 className="text-xl font-black font-headline uppercase tracking-tight mb-4 group-hover:text-primary transition-colors duration-500 italic">{f.title}</h3>
                  <p className="text-on-surface-variant/40 text-sm leading-relaxed font-light group-hover:text-on-surface-variant/80 transition-colors duration-500">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-24 lg:py-48 relative overflow-hidden">
        <div className="absolute top-1/2 left-[-100px] w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[150px] -z-10"></div>
        <div className="absolute bottom-0 right-[-100px] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[150px] -z-10"></div>

        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-20 lg:gap-32 items-center">

            {/* Right: Heading + Info (rendered first on mobile) */}
            <div className="order-1 lg:order-2">
              <span className="inline-block text-[10px] font-label font-bold uppercase tracking-[0.4em] text-secondary/60 mb-6">Edxiom Methodology</span>
              <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black font-headline uppercase tracking-tighter mb-8 leading-[0.9] italic">
                The Science of <br /><span className="text-secondary">Progression</span>
              </h2>
              <p className="text-lg sm:text-xl text-on-surface-variant/50 font-light leading-relaxed mb-12 max-w-lg">
                We've engineered Edxiom to reduce friction and maximize focus. Our systems handle the planning, so you can handle the learning.
              </p>
              <div className="flex items-center gap-6 group">
                <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20 group-hover:scale-110 transition-all duration-500 shadow-[0_0_30px_rgba(0,179,89,0.2)]">
                  <Shield size={24} />
                </div>
                <div>
                  <span className="block font-label font-black uppercase tracking-widest text-[10px] text-secondary mb-1">Security Protocol</span>
                  <p className="text-xs text-on-surface-variant/40 font-light italic leading-relaxed max-w-xs">
                    "Your data is localized and private. Edxiom's goal is your growth, not your attention."
                  </p>
                </div>
              </div>
            </div>

            {/* Left: Steps */}
            <div className="order-2 lg:order-1">
              <div className="space-y-12">
                {[
                  { num: '01', color: 'primary', title: 'Discovery Phase', desc: "Tell Edxiom what you want to achieve. Our AI analyzes your intent and level to start the architecture.",
                    bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', hoverBg: 'group-hover:bg-primary', shadow: 'shadow-primary/5', line: 'from-primary/30' },
                  { num: '02', color: 'secondary', title: 'Roadmap Generation', desc: "Edxiom generates a granular, step-by-step roadmap. Approve, refine, or import from external sources.",
                    bg: 'bg-secondary/10', text: 'text-secondary', border: 'border-secondary/20', hoverBg: 'group-hover:bg-secondary', shadow: 'shadow-secondary/5', line: 'from-secondary/30' },
                  { num: '03', color: 'primary', title: 'Verified Progression', desc: "Complete tasks and pass assessments. Progress is tracked and nudged via our integrated assistant.",
                    bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', hoverBg: 'group-hover:bg-primary', shadow: 'shadow-primary/5', line: 'from-primary/30' },
                ].map((step, i) => (
                  <div key={i} className="flex gap-8 group">
                    <div className="flex flex-col items-center">
                      <div className={`w-14 h-14 rounded-full ${step.bg} flex items-center justify-center ${step.text} font-black text-lg shrink-0 border ${step.border} ${step.hoverBg} group-hover:text-black transition-all duration-500 shadow-xl ${step.shadow}`}>
                        {step.num}
                      </div>
                      {i < 2 && <div className={`w-[2px] h-full mt-4 bg-gradient-to-b ${step.line} to-transparent opacity-20`}></div>}
                    </div>
                    <div className="pt-3">
                      <h4 className="text-xl font-black font-headline uppercase tracking-tight mb-3 group-hover:text-primary transition-colors duration-500 italic">{step.title}</h4>
                      <p className="text-on-surface-variant/50 font-light text-sm sm:text-base leading-relaxed max-w-md group-hover:text-on-surface-variant transition-colors duration-500">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="py-32 lg:py-56 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[200px] -z-10 animate-pulse"></div>

        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <h2 className="text-5xl sm:text-7xl lg:text-9xl font-black font-headline uppercase tracking-tighter leading-[0.85] mb-12 italic">
            Ready to build <br />your <span className="text-primary underline decoration-primary/20 decoration-8 underline-offset-[16px]">Edxiom</span>?
          </h2>
          <p className="text-lg sm:text-2xl text-on-surface-variant/40 font-light leading-relaxed mb-16 max-w-2xl mx-auto">
            Join the new era of high-accountability learning. No more passive consumption. Only active mastery.
          </p>
          <Link to="/register" className="group relative inline-flex items-center gap-4 px-14 py-6 bg-primary text-black rounded-full font-label font-black text-sm uppercase tracking-[0.4em] hover:scale-[1.05] active:scale-[0.95] transition-all shadow-[0_20px_100px_rgba(253,184,19,0.4)] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-secondary to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <span className="relative z-10">Create Free Account</span>
            <ArrowRight size={20} className="relative z-10 group-hover:translate-x-2 transition-transform duration-500" />
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-10 border-t border-outline-variant/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 opacity-60">
            <img src="/logo.png" alt="Edxiom" className="h-8 w-auto" />
            <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant">© {new Date().getFullYear()} Edxiom AI. All rights reserved.</span>
          </div>
          <div className="flex gap-8 opacity-40">
            <a href="#" className="text-[10px] font-label uppercase tracking-widest hover:text-primary hover:opacity-100 transition-all">Twitter</a>
            <a href="#" className="text-[10px] font-label uppercase tracking-widest hover:text-primary hover:opacity-100 transition-all">Discord</a>
            <a href="#" className="text-[10px] font-label uppercase tracking-widest hover:text-primary hover:opacity-100 transition-all">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
