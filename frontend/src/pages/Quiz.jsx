import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listGoals, getRoadmap, startQuiz, submitQuiz } from '../services/api';

const Quiz = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading'); // loading, select, quiz, result
  const [parts, setParts] = useState([]);
  const [quizData, setQuizData] = useState(null);
  const [quizId, setQuizId] = useState(null);
  const [partTitle, setPartTitle] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!user) { navigate('/onboarding'); return; }
    loadParts();
  }, [user]);

  useEffect(() => {
    if (phase === 'quiz') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setError('⏰ Session expired! Quiz reset triggered.');
            setPhase('select');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const loadParts = async () => {
    try {
      const goals = await listGoals();
      const activeParts = [];
      for (const goal of goals) {
        const rm = await getRoadmap(goal.id);
        for (const task of rm.tasks) {
          for (const part of task.parts) {
            if (part.status === 'active') {
              activeParts.push({ ...part, taskTitle: task.title, goalTitle: goal.title });
            }
          }
        }
      }
      setParts(activeParts);
      setPhase('select');
    } catch (e) {
      setError(e.message);
      setPhase('select');
    }
  };

  const handleStartQuiz = async (partId, title) => {
    setLoading(true);
    setError('');
    try {
      const data = await startQuiz(partId);
      setQuizData(data.questions);
      setQuizId(data.quiz_id);
      setPartTitle(title);
      setCurrentQ(0);
      setAnswers([]);
      setSelectedOption(null);
      setTimeLeft(15 * 60);
      setPhase('quiz');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleSelectOption = (idx) => setSelectedOption(idx);

  const handleNext = () => {
    if (selectedOption === null) return;
    const newAnswers = [...answers, selectedOption];
    setAnswers(newAnswers);

    if (currentQ + 1 < quizData.length) {
      setCurrentQ(currentQ + 1);
      setSelectedOption(null);
    } else {
      handleSubmit(newAnswers);
    }
  };

  const handleSubmit = async (finalAnswers) => {
    setLoading(true);
    clearInterval(timerRef.current);
    try {
      const res = await submitQuiz(quizId, finalAnswers);
      setResult(res);
      setPhase('result');
      refreshUser();
    } catch (e) {
      setError(e.message);
      setPhase('select');
    }
    setLoading(false);
  };

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (phase === 'loading') {
    return (
      <div className="animate-in fade-in duration-1000 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined text-primary text-6xl animate-pulse">quiz</span>
          <p className="text-on-surface-variant font-label text-sm mt-4 uppercase tracking-widest">Loading available quizzes...</p>
        </div>
      </div>
    );
  }

  // SELECT PART PHASE
  if (phase === 'select') {
    return (
      <div className="animate-in fade-in duration-1000 max-w-3xl mx-auto w-full">
        <header className="mb-12">
          <h2 className="text-4xl font-black tracking-tighter text-on-surface mb-2 font-headline uppercase">Sudden Death Quiz</h2>
          <p className="text-on-surface-variant font-label tracking-wide uppercase text-xs opacity-60">Select a topic to begin verification</p>
        </header>
        {error && (
          <div className="mb-8 p-4 bg-error-container/20 border border-error/30 rounded-xl">
            <p className="text-error text-xs font-label font-bold">{error}</p>
          </div>
        )}
        {parts.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4">inbox</span>
            <p className="text-on-surface-variant font-label uppercase tracking-widest">No active parts. Set a goal first.</p>
            <button onClick={() => navigate('/onboarding')} className="mt-6 px-8 py-3 bg-primary rounded-xl font-label text-xs font-bold uppercase tracking-widest text-on-primary-container">
              Set Goal
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {parts.map((part) => (
              <button
                key={part.id}
                onClick={() => handleStartQuiz(part.id, part.title)}
                disabled={loading}
                className="w-full group flex items-center justify-between p-8 bg-surface-container-low border border-outline-variant/10 rounded-2xl hover:border-primary/30 hover:bg-surface-container transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined">bolt</span>
                  </div>
                  <div>
                    <h4 className="font-headline font-bold text-on-surface text-lg">{part.title}</h4>
                    <p className="text-on-surface-variant text-xs font-label uppercase tracking-widest">{part.goalTitle} • {part.taskTitle}</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-primary">arrow_forward</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // QUIZ PHASE
  if (phase === 'quiz' && quizData) {
    const q = quizData[currentQ];
    return (
      <div className="animate-in fade-in duration-1000 max-w-5xl mx-auto w-full flex flex-col items-center">
        {/* Integrity Warning + Timer */}
        <div className="w-full mb-12 flex flex-col items-center">
          <div className="flex items-center gap-3 py-3 px-6 bg-error-container/10 border border-error/20 rounded-xl mb-4">
            <span className="material-symbols-outlined text-error animate-pulse">warning</span>
            <p className="font-label text-xs tracking-wide text-error font-bold uppercase">
              Hard Reset Protocol Active — {formatTime(timeLeft)} remaining
            </p>
          </div>
        </div>

        {/* Question */}
        <section className="w-full mb-16 space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-label text-primary text-[10px] tracking-[0.2em] font-bold uppercase">
              Q{currentQ + 1}/{quizData.length} // {partTitle}
            </span>
            <div className="h-[1px] flex-grow bg-surface-container-highest/30"></div>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight text-on-surface">
            {q.question}
          </h1>
        </section>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-16">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelectOption(i)}
              className={`group relative flex items-start gap-6 p-8 bg-surface-container-low hover:bg-surface-container text-left transition-all duration-300 border rounded-xl active:scale-[0.98] ${
                selectedOption === i ? 'border-primary/40 glow-blue' : 'border-transparent hover:border-primary/20'
              }`}
            >
              <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg transition-colors ${
                selectedOption === i ? 'bg-primary/20' : 'bg-surface-container-highest group-hover:bg-primary/10'
              }`}>
                <span className={`font-label font-bold text-lg transition-colors ${
                  selectedOption === i ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'
                }`}>{String.fromCharCode(65 + i)}</span>
              </div>
              <div className="space-y-1">
                <p className={`text-on-surface text-sm leading-relaxed ${selectedOption === i ? 'font-bold' : 'font-light opacity-80'}`}>{opt}</p>
              </div>
              {selectedOption === i && (
                <div className="absolute bottom-4 right-6">
                  <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Submit */}
        <button
          onClick={handleNext}
          disabled={selectedOption === null || loading}
          className="group relative px-12 py-5 bg-gradient-to-br from-primary to-primary-container rounded-full overflow-hidden transition-all duration-300 active:scale-95 glow-blue disabled:opacity-40"
        >
          <span className="relative font-label font-bold tracking-[0.3em] text-on-primary-container text-lg uppercase">
            {loading ? 'Processing...' : currentQ + 1 < quizData.length ? 'Next Question' : 'Submit Answers'}
          </span>
        </button>
      </div>
    );
  }

  // RESULT PHASE
  if (phase === 'result' && result) {
    return (
      <div className="animate-in fade-in duration-1000 max-w-2xl mx-auto w-full flex flex-col items-center justify-center min-h-[60vh]">
        <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-8 shadow-2xl ${
          result.is_passed
            ? 'bg-gradient-to-br from-primary to-secondary shadow-primary/30'
            : 'bg-gradient-to-br from-error to-error-container shadow-error/30'
        }`}>
          <span className="material-symbols-outlined text-white text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            {result.is_passed ? 'military_tech' : 'restart_alt'}
          </span>
        </div>
        <h2 className="text-4xl font-black font-headline uppercase tracking-tighter mb-4">
          {result.is_passed ? 'Mastery Verified' : 'Verification Failed'}
        </h2>
        <p className="text-xl font-headline text-on-surface-variant mb-2">Score: <span className="text-on-surface font-bold">{result.score_percent}%</span></p>
        <p className="text-sm text-on-surface-variant font-label mb-12">{result.message}</p>
        <div className="flex gap-4">
          {result.is_passed ? (
            <button onClick={() => navigate('/')} className="px-10 py-4 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary-container font-label text-xs font-bold tracking-widest uppercase shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
              Continue
            </button>
          ) : (
            <button onClick={() => { setPhase('select'); loadParts(); }} className="px-10 py-4 rounded-full bg-gradient-to-br from-error to-error-container text-white font-label text-xs font-bold tracking-widest uppercase shadow-xl shadow-error/20 hover:scale-[1.02] active:scale-95 transition-all">
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default Quiz;
