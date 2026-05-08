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
      <nav className={`fixed top-0 left-0 w-full z-[100] transition-all duration-500 ${
        isScrolled 
          ? 'bg-[#0e0e10]/90 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] border-b border-outline-variant/10' 
          : 'bg-gradient-to-b from-[#0e0e10]/80 to-transparent border-b border-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 flex items-center justify-between h-20 sm:h-24">
          
          {/* Logo */}
          <Link to="/" className="relative flex items-center group shrink-0">
            <img 
              src="/logo.png" 
              alt="Axiom" 
              className="w-auto h-14 sm:h-16 lg:h-20 drop-shadow-[0_0_30px_rgba(253,184,19,0.4)] transition-transform duration-500 group-hover:scale-105" 
            />
          </Link>

          {/* Center Nav Links (Desktop) */}
          <div className="hidden lg:flex items-center gap-10">
            <a href="#features" className="text-[11px] font-label font-bold uppercase tracking-[0.25em] text-on-surface-variant/70 hover:text-primary transition-colors duration-300 relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 hover:after:w-full after:h-[2px] after:bg-primary after:transition-all after:duration-300">Features</a>
            <a href="#how-it-works" className="text-[11px] font-label font-bold uppercase tracking-[0.25em] text-on-surface-variant/70 hover:text-primary transition-colors duration-300 relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 hover:after:w-full after:h-[2px] after:bg-primary after:transition-all after:duration-300">How it works</a>
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/onboarding" className="px-5 py-2.5 rounded-full border border-outline-variant/20 text-on-surface-variant font-label font-bold text-[10px] uppercase tracking-[0.15em] hover:border-primary/40 hover:text-primary transition-all duration-300">
              Sign In
            </Link>
            <Link to="/onboarding" className="px-6 py-2.5 bg-primary text-on-primary-container rounded-full font-label font-bold text-[10px] uppercase tracking-[0.15em] hover:shadow-[0_8px_30px_rgba(253,184,19,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
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
        <div className={`md:hidden overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
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
              <Link to="/onboarding" onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3.5 rounded-xl border border-outline-variant/20 text-on-surface-variant font-label font-bold text-[11px] uppercase tracking-widest hover:border-primary/40 hover:text-primary transition-all text-center">
                Sign In
              </Link>
              <Link to="/onboarding" onClick={() => setMobileMenuOpen(false)}
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
        <div className="absolute inset-0 axiom-grid opacity-[0.03] -z-10"></div>
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/8 rounded-full blur-[200px] -z-10"></div>
        <div className="absolute bottom-[-100px] right-[-200px] w-[600px] h-[400px] bg-secondary/5 rounded-full blur-[150px] -z-10"></div>

        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="z-10 order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/15 bg-primary/5 mb-8">
              <Sparkles size={14} className="text-primary" />
              <span className="text-[10px] font-label font-bold uppercase tracking-[0.2em] text-primary/80">AI-Powered Learning</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black font-headline uppercase tracking-tighter leading-[0.92] mb-6">
              Master Your <span className="text-primary italic">Focus</span>.<br />
              Architect Your <span className="text-secondary italic">Future</span>.
            </h1>
            <p className="text-base sm:text-lg text-on-surface-variant/70 font-light leading-relaxed mb-10 max-w-lg">
              Axiom is a high-accountability learning ecosystem. We transform fragmented content into structured mastery paths using world-class AI coaching.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/onboarding" className="px-8 py-4 bg-primary text-on-primary-container rounded-full font-label font-bold text-xs uppercase tracking-[0.2em] hover:scale-[1.03] active:scale-[0.97] transition-all shadow-[0_10px_40px_rgba(253,184,19,0.25)] flex items-center justify-center gap-3">
                Begin Your Path <ArrowRight size={16} />
              </Link>
              <a href="#features" className="px-8 py-4 bg-white/[0.03] border border-outline-variant/15 text-on-surface rounded-full font-label font-bold text-xs uppercase tracking-[0.2em] hover:bg-white/[0.06] hover:border-outline-variant/25 transition-all flex items-center justify-center">
                Explore Features
              </a>
            </div>
          </div>

          {/* Right: Visual */}
          <div className="relative order-1 lg:order-2 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 blur-[80px] -z-10"></div>
            <RoadmapVisual />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 lg:py-40 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24 max-w-2xl mx-auto">
            <h2 className="text-4xl lg:text-6xl font-black font-headline uppercase tracking-tighter mb-6">Built for High <span className="text-primary">Performance</span></h2>
            <p className="text-on-surface-variant font-light text-lg">Traditional learning is broken by cognitive overload. Axiom fixes it with precision architecture.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((f, i) => (
              <div key={i} className="group p-8 rounded-[2.5rem] bg-surface-container-low/40 border border-outline-variant/5 hover:border-primary/20 transition-all duration-500 hover:-translate-y-2">
                <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-8 border border-outline-variant/10 group-hover:bg-primary/5 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold font-headline uppercase tracking-tight mb-4 group-hover:text-primary transition-colors">{f.title}</h3>
                <p className="text-on-surface-variant/70 text-sm leading-relaxed font-light">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / How it works */}
      <section id="how-it-works" className="py-24 lg:py-40 bg-surface-container-low/30 relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-secondary/5 rounded-full blur-[120px] -z-10"></div>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="space-y-12">
                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black shrink-0 border border-primary/20 shadow-lg shadow-primary/5">1</div>
                  <div>
                    <h4 className="text-xl font-bold font-headline uppercase tracking-tight mb-2">Discovery Phase</h4>
                    <p className="text-on-surface-variant/80 font-light">Tell Axiom what you want to achieve. Our AI analyzes your intent and level to start the architecture.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-black shrink-0 border border-secondary/20 shadow-lg shadow-secondary/5">2</div>
                  <div>
                    <h4 className="text-xl font-bold font-headline uppercase tracking-tight mb-2">Roadmap Generation</h4>
                    <p className="text-on-surface-variant/80 font-light">Axiom generates a granular, step-by-step roadmap. Approve, refine, or import from external sources.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black shrink-0 border border-primary/20 shadow-lg shadow-primary/5">3</div>
                  <div>
                    <h4 className="text-xl font-bold font-headline uppercase tracking-tight mb-2">Verified Progression</h4>
                    <p className="text-on-surface-variant/80 font-light">Complete tasks and pass assessments. Progress is tracked and nudged via our integrated assistant.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-4xl lg:text-6xl font-black font-headline uppercase tracking-tighter mb-8 leading-none">The Science of <br /><span className="text-secondary italic">Progression</span></h2>
              <p className="text-lg text-on-surface-variant/70 font-light leading-relaxed mb-10">
                We've engineered Axiom to reduce friction and maximize focus. Our systems handle the planning, so you can handle the learning.
              </p>
              <div className="p-8 rounded-[2.5rem] bg-[#0e0e10] border border-outline-variant/10">
                <div className="flex items-center gap-4 mb-4 text-secondary">
                  <Shield size={20} />
                  <span className="font-label font-bold uppercase tracking-widest text-[10px]">Security Guaranteed</span>
                </div>
                <p className="text-xs text-on-surface-variant font-light italic leading-relaxed">
                  "Your data is localized and private. Axiom's goal is your growth, not your attention."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 lg:py-56 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-6xl lg:text-8xl font-black font-headline uppercase tracking-tighter leading-none mb-10">Ready to build <br />your <span className="text-primary underline decoration-primary/30 decoration-8 underline-offset-8">Axiom</span>?</h2>
          <p className="text-xl text-on-surface-variant/80 font-light leading-relaxed mb-16">
            Join the new era of high-accountability learning. No more passive consumption. Only active mastery.
          </p>
          <Link to="/onboarding" className="inline-flex items-center gap-4 px-12 py-6 bg-primary text-on-primary-container rounded-full font-label font-bold text-sm uppercase tracking-[0.4em] hover:scale-105 active:scale-95 transition-all shadow-[0_30px_100px_rgba(253,184,19,0.3)]">
            Create Free Account <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-outline-variant/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3 opacity-50">
            <img src="/logo.png" alt="Axiom" className="h-6 w-auto grayscale" />
            <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant">© 2024 Axiom AI. All rights reserved.</span>
          </div>
          <div className="flex gap-10 opacity-50">
            <a href="#" className="text-[9px] font-label uppercase tracking-widest hover:text-primary">Twitter</a>
            <a href="#" className="text-[9px] font-label uppercase tracking-widest hover:text-primary">Discord</a>
            <a href="#" className="text-[9px] font-label uppercase tracking-widest hover:text-primary">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
