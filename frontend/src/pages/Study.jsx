import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startQuiz, submitQuiz, getPartContent } from '../services/api';
import { useData } from '../context/DataContext';
import NeuralLoader from '../components/NeuralLoader';

const Study = () => {
  const { user, refreshUser } = useAuth();
  const { goals, roadmap, loading: dataLoading, refreshData } = useData();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading'); // loading, select, quiz, result
  const [activeTask, setActiveTask] = useState(null);
  const [activeGoal, setActiveGoal] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [quizToken, setQuizToken] = useState(null);
  const [partTitle, setPartTitle] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [learningContent, setLearningContent] = useState(null);
  const [activePartId, setActivePartId] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!user) { navigate('/onboarding'); return; }
    if (roadmap && goals) {
      let foundTask = null;
      let foundGoal = null;

      // Find the specific roadmap for the current goal (if possible) or use the active goal
      const primaryGoal = goals.find(g => g.status === 'active') || goals[0];
      
      if (roadmap.tasks) {
        for (const task of roadmap.tasks) {
          if (task.status === 'active') {
            foundTask = task;
            foundGoal = primaryGoal;
            break; // Stop at first ACTIVE task
          }
          if (task.status === 'locked' && !foundTask) {
            foundTask = task;
            foundGoal = primaryGoal;
            // Don't break yet, keep looking for an active one later in the list
          }
        }
      }

      setActiveTask(foundTask);
      setActiveGoal(foundGoal);
      setPhase('select');
    }
  }, [user, roadmap, goals]);

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

  const handleStartLearning = async (partId, title) => {
    setLoading(true);
    setLoadingContent(true);
    setError('');
    setActivePartId(partId);
    setPartTitle(title);
    try {
      const data = await getPartContent(partId);
      setLearningContent(data.content);
      setPhase('learning');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingContent(false);
    }
  };

  const handleStartQuiz = async () => {
    const partId = activePartId;
    const title = partTitle;
    setLoading(true);
    setLoadingQuiz(true);
    setError('');
    try {
      const data = await startQuiz(partId);
      setQuizData(data.questions);
      setQuizToken(data.quiz_token);
      setPartTitle(title);
      setCurrentQ(0);
      setAnswers([]);
      setSelectedOption(null);
      setTimeLeft(15 * 60);
      setLoadingQuiz(false);
      setPhase('quiz');
    } catch (e) {
      setError(e.message);
      setLoadingQuiz(false);
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
    setSubmittingQuiz(true);
    clearInterval(timerRef.current);
    try {
      const res = await submitQuiz(quizToken, finalAnswers);
      setResult(res);
      setSubmittingQuiz(false);
      setPhase('result');
      await refreshData();
      refreshUser();
    } catch (e) {
      setError(e.message);
      setSubmittingQuiz(false);
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
          <p className="text-on-surface-variant font-label text-sm mt-4 uppercase tracking-widest">Loading study sessions...</p>
        </div>
      </div>
    );
  }

  // Full-screen loading overlays for LLM operations
  const renderLoaders = () => (
    <>
      {loadingQuiz && (
        <NeuralLoader
          message="CREATING NEURAL QUIZ"
          subMessages={[
            'Creating custom challenge',
            'Calibrating neural depth',
            'Tapping into node repositories',
            'Preparing verification parameters',
            'Finalizing neural synthesis',
          ]}
        />
      )}
      {submittingQuiz && (
        <NeuralLoader
          message="Evaluating Answers"
          subMessages={[
            'Analyzing your responses',
            'Computing mastery score',
            'Validating knowledge depth',
            'Generating performance report',
            'Updating your progress',
          ]}
        />
      )}
      {loadingContent && (
        <NeuralLoader
          message="Synthesizing Knowledge"
          subMessages={[
            'Tapping into neural repositories',
            'Scraping real-time records',
            'Structuring documentation',
            'Calibrating educational depth',
            'Finalizing neural synthesis',
          ]}
        />
      )}
    </>
  );

  // SELECT PHASE (RESTRUCTURED)
  if (phase === 'select') {
    return (
      <div className="animate-in fade-in duration-1000 max-w-4xl mx-auto w-full">
        {renderLoaders()}
        <header className="mb-12 text-center">
          <h2 className="text-4xl font-black tracking-tighter text-on-surface mb-2 font-headline uppercase">Neural Study Session</h2>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] font-label tracking-[0.3em] uppercase text-primary font-bold opacity-80">Target:</span>
            <span className="text-[10px] font-label tracking-[0.3em] uppercase text-on-surface-variant font-bold">{activeGoal?.title || 'Unknown Synthesis'}</span>
          </div>
          <p className="mt-4 text-[9px] text-on-surface-variant font-label tracking-widest uppercase opacity-40 italic">Verification Protocol // Neural Integrity</p>
        </header>

        {error && (
          <div className="mb-8 p-4 bg-error-container/20 border border-error/30 rounded-xl max-w-2xl mx-auto">
            <p className="text-error text-xs font-label font-bold text-center">{error}</p>
          </div>
        )}

        {!activeTask ? (
          <div className="text-center py-16 bg-surface-container-low rounded-3xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4">analytics</span>
            <p className="text-on-surface-variant font-label uppercase tracking-widest text-sm">Initializing mastery protocols...</p>
            <button onClick={() => navigate('/onboarding')} className="mt-8 px-10 py-4 bg-primary rounded-xl font-label text-xs font-bold uppercase tracking-widest text-on-primary-container shadow-xl shadow-primary/20">
              Set Goal & Roadmap
            </button>
          </div>
        ) : (
          <div className="space-y-8 max-w-3xl mx-auto">
            {/* Active Module Header Card */}
            <div className="bg-surface-container-low border border-outline-variant/15 p-10 rounded-[2.5rem] relative overflow-hidden group shadow-2xl shadow-black/20">
              <div className="absolute top-0 right-0 p-8">
                 <span className={`px-4 py-1.5 rounded-lg text-[10px] font-label font-black tracking-widest uppercase border ${
                   activeTask.status === 'active' ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container-highest border-outline-variant/30 text-on-surface-variant'
                 }`}>
                   {activeTask.status}
                 </span>
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                  <span className="text-[10px] font-label font-bold tracking-[0.2em] text-primary uppercase">Active Module</span>
                </div>
                <h3 className="text-4xl font-black font-headline text-on-surface leading-tight md:pr-24">
                  {activeTask.title}
                </h3>
              </div>

              {/* Parts Timeline */}
              <div className="mt-12 space-y-4 relative">
                {/* Vertical Line */}
                <div className="absolute left-6 top-0 bottom-0 w-[1px] bg-outline-variant/20 ml-[-0.5px]"></div>

                {activeTask.parts.map((part, idx) => {
                  const isActive = part.status === 'active';
                  const isLocked = part.status === 'locked';
                  const isPassed = part.status === 'passed';

                  return (
                    <div 
                      key={part.id} 
                      className={`relative flex items-center justify-between p-6 rounded-2xl border transition-all duration-300 ml-12 ${
                        isActive 
                        ? 'bg-surface-container-highest/40 border-primary/30 shadow-lg shadow-primary/5 cursor-pointer hover:scale-[1.02] active:scale-[0.98]' 
                        : 'bg-transparent border-outline-variant/10'
                      } ${isLocked ? 'opacity-40' : 'opacity-100'}`}
                      onClick={() => isActive && handleStartLearning(part.id, part.title)}
                    >
                      {/* Timeline Dot */}
                      <div className={`absolute left-[-31px] w-4 h-4 rounded-full border-4 border-surface-container-low z-20 ${
                        isActive ? 'bg-secondary animate-pulse shadow-[0_0_12px_rgba(0,179,89,0.4)]' : isPassed ? 'bg-secondary' : 'bg-outline-variant/40'
                      }`}></div>

                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                          isActive ? 'bg-primary/20 text-primary' : 'bg-surface-container-highest text-on-surface-variant'
                         }`}>
                          <span className="material-symbols-outlined text-[20px]">
                            {isActive ? 'bolt' : isLocked ? 'lock' : 'verified'}
                          </span>
                        </div>
                        <div>
                          <h4 className={`text-sm font-bold ${isActive ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                            {part.title}
                          </h4>
                          <span className={`text-[9px] font-label tracking-widest uppercase font-bold ${isActive ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                            {part.status}
                          </span>
                        </div>
                      </div>

                      {isActive && (
                        <span className="material-symbols-outlined text-primary text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // LEARNING PHASE
  if (phase === 'learning' && learningContent) {
    return (
      <div className="animate-in slide-in-from-bottom duration-1000 max-w-4xl mx-auto w-full">
        {renderLoaders()}
        <header className="mb-12 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-label tracking-[0.2em] text-primary uppercase font-bold mb-2 block">Neural Documentation</span>
            <h2 className="text-4xl font-black font-headline text-on-surface uppercase tracking-tight">{partTitle}</h2>
          </div>
          <button 
            onClick={() => setPhase('select')}
            className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="bg-surface-container-low border border-outline-variant/10 rounded-[2.5rem] p-10 md:p-16 shadow-2xl relative">
          {/* Content area with some markdown-ish styling */}
          <div className="prose prose-invert max-w-none text-on-surface-variant font-light leading-relaxed space-y-6">
            {learningContent.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold text-on-surface mt-8 mb-4">{line.replace('## ', '')}</h2>;
              if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-bold text-on-surface mt-6 mb-3">{line.replace('### ', '')}</h3>;
              if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc marker:text-primary">{line.replace('- ', '')}</li>;
              if (line.trim() === '') return <br key={i} />;
              return <p key={i}>{line}</p>;
            })}
          </div>

          <div className="mt-16 pt-8 border-t border-outline-variant/10 flex flex-col items-center">
            <p className="text-[10px] font-label text-on-surface-variant/40 uppercase tracking-[0.3em] mb-8 italic">Neural integrity verification required for progression</p>
            <button
              onClick={handleStartQuiz}
              className="group relative px-12 py-5 bg-gradient-to-br from-primary to-secondary rounded-full overflow-hidden transition-all duration-300 active:scale-95 glow-gold"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative font-label font-bold tracking-[0.3em] text-on-primary-container text-lg uppercase">Begin Quiz</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // QUIZ PHASE
  if (phase === 'quiz' && quizData) {
    const q = quizData[currentQ];
    return (
      <div className="animate-in fade-in duration-1000 max-w-5xl mx-auto w-full flex flex-col items-center">
        {renderLoaders()}
        {renderLoaders()}

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
                selectedOption === i ? 'border-primary/40 glow-gold' : 'border-transparent hover:border-primary/20'
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
          className="group relative px-12 py-5 bg-gradient-to-br from-primary to-secondary rounded-full overflow-hidden transition-all duration-300 active:scale-95 glow-gold disabled:opacity-40"
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
            <button onClick={() => { setPhase('select'); refreshData(); }} className="px-10 py-4 rounded-full bg-gradient-to-br from-error to-error-container text-white font-label text-xs font-bold tracking-widest uppercase shadow-xl shadow-error/20 hover:scale-[1.02] active:scale-95 transition-all">
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default Study;
