import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, Check, Compass, BookOpen, Calendar, Bot } from 'lucide-react';

export default function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('edxiom_tour_completed');
    if (!hasSeenTour) {
      const timer = setTimeout(() => setIsOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const tourSteps = [
    {
      title: 'Welcome to Edxiom',
      subtitle: 'Your Autonomous Proof-of-Learning Platform',
      content: 'Edxiom is not a passive task tracker. It interrogates your goals, builds custom roadmaps, and gates your progression through verified AI quizzes.',
      icon: Sparkles,
      color: 'text-primary bg-primary/15',
    },
    {
      title: 'The AI Architect',
      subtitle: 'Personalized Curriculums',
      content: 'Use the Onboarding tab to chat with our AI Architect or paste YouTube playlist URLs. Edxiom synthesizes structured modules matched to your timeframe.',
      icon: Compass,
      color: 'text-blue-400 bg-blue-500/15',
    },
    {
      title: 'Mastery Workbench',
      subtitle: 'Neural Seals & Quizzes',
      content: 'In the Study Workbench, read curated synthesis, view math formulas with KaTeX, take rich notes, and pass Sudden Death Quizzes (≥80%) to unlock the next level.',
      icon: BookOpen,
      color: 'text-amber-400 bg-amber-500/15',
    },
    {
      title: 'Daily Cadence & Bot',
      subtitle: 'Stay on Track',
      content: 'Link your Telegram (@Axiomneurobot) in Settings for daily interactive study nudges. Use Ctrl+K anytime to quickly jump anywhere in the app!',
      icon: Bot,
      color: 'text-green-400 bg-green-500/15',
    },
  ];

  const handleFinish = () => {
    localStorage.setItem('edxiom_tour_completed', 'true');
    setIsOpen(false);
  };

  const handleNext = () => {
    if (step < tourSteps.length - 1) {
      setStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  if (!isOpen) return null;

  const current = tourSteps[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-surface-container-high border border-outline-variant/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6 animate-in zoom-in-95 duration-200">
        {/* Progress indicator */}
        <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
          <div className="flex items-center gap-1.5">
            {tourSteps.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === step ? 'w-8 bg-primary' : idx < step ? 'w-3 bg-primary/40' : 'w-3 bg-surface-container-highest'
                }`}
              />
            ))}
          </div>
          <button 
            onClick={handleFinish}
            className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Skip Tour
          </button>
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${current.color} mb-4`}>
            <Icon size={28} />
          </div>

          <div>
            <span className="text-[10px] font-label uppercase tracking-widest text-primary font-bold">
              {current.subtitle}
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-on-surface font-headline uppercase tracking-tight mt-1">
              {current.title}
            </h3>
          </div>

          <p className="text-sm text-on-surface-variant leading-relaxed">
            {current.content}
          </p>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
          <span className="text-xs font-mono text-on-surface-variant">
            Step {step + 1} of {tourSteps.length}
          </span>
          <button
            onClick={handleNext}
            className="py-2.5 px-6 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(253,184,19,0.3)]"
          >
            {step === tourSteps.length - 1 ? (
              <>Get Started <Check size={16} /></>
            ) : (
              <>Next Step <ArrowRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
