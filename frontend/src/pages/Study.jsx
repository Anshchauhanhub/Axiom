import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startQuiz, submitQuiz, getPartContent, updateGoalNotes } from '../services/api';
import { useData } from '../context/DataContext';
import NeuralLoader from '../components/NeuralLoader';
import MultimediaEditor from '../components/MultimediaEditor';
import StudySidebar from '../components/study/StudySidebar';
import StudyWorkbenchMain from '../components/study/StudyWorkbenchMain';
const Study = () => {
  const { user, refreshUser } = useAuth();
  const { goals, roadmap, loading: dataLoading, refreshData, selectedGoalId, setSelectedGoalId } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState('loading'); // loading, select, learning, quiz, result
  const [viewMode, setViewMode] = useState('task'); // 'task' or 'roadmap'
  const [activeTask, setActiveTask] = useState(null);
  const activeTaskRef = useRef(false);
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
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const timerRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const editorRef = useRef(null);
  const initialNotesRef = useRef(null);

  useEffect(() => {
    if (!user) { navigate('/onboarding'); return; }
    
    if (!dataLoading && goals && goals.length === 0) {
      navigate('/onboarding');
      return;
    }

    if (roadmap && goals && goals.length > 0) {
      let foundTask = null;
      let foundGoal = null;

      const targetGoalId = location.state?.goalId || selectedGoalId;
      const primaryGoal = (targetGoalId ? goals.find(g => g.id === targetGoalId) : null) || goals.find(g => g.status === 'active') || goals[0];
      
      // Wait for the roadmap to sync with the selected goal before processing
      if (roadmap.goal && primaryGoal && roadmap.goal.id !== primaryGoal.id) {
        return;
      }
      
      if (roadmap.tasks) {
        for (const task of roadmap.tasks) {
          if (task.status === 'active') {
            foundTask = task;
            foundGoal = primaryGoal;
            break; 
          }
          if (task.status === 'locked' && !foundTask) {
            foundTask = task;
            foundGoal = primaryGoal;
          }
        }
      }

      const prevGoalId = activeGoal?.id;
      
      // Default to the natural progress task if nothing is manually selected
      if (!activeTaskRef.current) {
         setActiveTask(foundTask);
         activeTaskRef.current = true;
      }
      setActiveGoal(foundGoal);
      
      // Update notes and editor content ONLY if the goal has changed
      if (foundGoal && foundGoal.id !== prevGoalId) {
        // Migration: Ensure notes is at least an empty array or the current goal's notes
        const newNotes = foundGoal.notes || [];
        setNotes(newNotes); 
        initialNotesRef.current = JSON.stringify(newNotes);
      }
      
      // Fix: Only reset to 'select' if we are in the initial loading state.
      if (phase === 'loading') {
        setPhase('select');
      }
    } else if (!dataLoading && goals && goals.length > 0 && !roadmap) {
      // If we finished loading data but roadmap is still null (e.g. API error),
      // we must break out of the loading phase so the user isn't stuck forever.
      if (phase === 'loading') {
        setPhase('select');
      }
    }
  }, [user, dataLoading, roadmap, goals, navigate, phase, activeGoal?.id, selectedGoalId, location.state?.goalId]);

  // Auto-open notebook when navigating from Dashboard Neural Notebook section
  useEffect(() => {
    if (location.state?.openNotebook && goals?.length > 0 && phase !== 'loading') {
      setShowNotes(true);
      // Don't clear state completely so we keep the goalId
      window.history.replaceState({ ...location.state, openNotebook: false }, '');
    }
  }, [location.state, goals, phase]);

  // Hide global TopNav notification icon when Notebook is open to prevent overlap
  useEffect(() => {
    if (showNotes) {
      document.body.classList.add('notebook-open');
    } else {
      document.body.classList.remove('notebook-open');
    }
    return () => document.body.classList.remove('notebook-open');
  }, [showNotes]);

  useEffect(() => {
    if (!activeGoal || !showNotes) return;
    
    // Prevent saving if notes haven't actually changed from initial load
    const currentNotesStr = JSON.stringify(notes);
    if (currentNotesStr === initialNotesRef.current) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await updateGoalNotes(activeGoal.id, notes);
        initialNotesRef.current = currentNotesStr;
        refreshData(); // Sync with global state
      } catch (e) {
        console.error('Failed to save notes:', e);
      } finally {
        setIsSaving(false);
      }
    }, 2000);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [notes, activeGoal, showNotes, refreshData]);

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
    setPartTitle(title.split(' || ')[0]);
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

  const handleSelectTask = (task) => {
    setActiveTask(task);
    setViewMode('task');
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
      setPhase('quiz');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingQuiz(false);
      setLoading(false);
    }
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
      setPhase('result');
      await refreshData();
      refreshUser();
    } catch (e) {
      setError(e.message);
      setPhase('select');
    } finally {
      setSubmittingQuiz(false);
      setLoading(false);
    }
  };




  const handleExport = () => {
    if (!notes || !Array.isArray(notes)) return;
    
    const title = activeGoal?.title || 'Study_Session';
    const date = new Date().toLocaleDateString();
    
    // Convert blocks to HTML for Word
    const blockHtml = notes.map(b => {
      if (b.type === 'text') return `<div style="margin-bottom: 20px;">${b.content}</div>`;
      if (b.type === 'image') return `<div style="text-align: center; margin-bottom: 30px;"><img src="${b.url}" style="max-width: 100%;"><p style="font-size: 10pt; color: #666;">${b.caption}</p></div>`;
      if (b.type === 'video') return `<div style="text-align: center; margin-bottom: 30px;"><p style="font-size: 10pt; color: #666;">View video at: <a href="${b.url}">${b.url}</a></p></div>`;
      return '';
    }).join('');

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${title}</title>
        <style>
          body { font-family: 'Georgia', serif; line-height: 1.6; color: #333; padding: 50px; }
          h1 { color: #000; text-align: center; text-transform: uppercase; margin-bottom: 30px; font-family: sans-serif; }
          .footer { margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; font-size: 10px; color: #999; text-align: center; font-family: sans-serif; }
          b, strong { font-weight: bold; }
          i, em { font-style: italic; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div>${blockHtml}</div>
        <div class="footer">
          GENERATED BY EDXIOM // ${date} // ${user?.name || 'User'}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}_Notes.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderLoaders = () => (
    <>
      {loadingQuiz && (
        <NeuralLoader
          message="PREPARING ASSESSMENT"
          subMessages={[
            'Creating study challenge',
            'Calibrating knowledge depth',
            'Tapping into repositories',
            'Preparing parameters',
            'Finalizing preparation',
          ]}
        />
      )}
      {submittingQuiz && (
        <NeuralLoader
          message="EVALUATION"
          subMessages={[
            'Analyzing responses',
            'Computing score',
            'Validating integrity',
            'Generating final performance record',
            'Updating archives',
          ]}
        />
      )}
      {loadingContent && (
        <NeuralLoader
          message="Generating Content"
          subMessages={[
            'Tapping into repositories',
            'Scraping real-time records',
            'Structuring documentation',
            'Calibrating educational depth',
            'Finalizing preparation',
          ]}
        />
      )}
    </>
  );

  const renderParsedContent = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let currentBlock = [];
    let inCodeBlock = false;
    let codeLanguage = '';

    const parseInline = (line) => {
      // Handle **bold**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-black text-on-surface bg-primary/10 px-1 rounded">{part.slice(2, -2)}</strong>;
        }
        // Handle `code`
        const codeParts = part.split(/(`.*?`)/g);
        return codeParts.map((cp, j) => {
          if (cp.startsWith('`') && cp.endsWith('`')) {
            return <code key={j} className="bg-surface-container-highest px-1.5 py-0.5 rounded font-mono text-primary text-sm font-bold uppercase tracking-tighter">{cp.slice(1, -1)}</code>;
          }
          return cp;
        });
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('[youtube:')) {
        const videoId = line.replace('[youtube:', '').replace(']', '').trim();
        elements.push(
          <div key={`yt-${i}`} className="my-8 rounded-3xl overflow-hidden border border-outline-variant/10 shadow-2xl aspect-video relative group transition-all duration-500 hover:border-primary/30">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            ></iframe>
          </div>
        );
        continue;
      }

      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // Close block
          elements.push(
            <div key={`code-${i}`} className="my-8 rounded-3xl overflow-hidden border border-outline-variant/10 shadow-2xl group transition-all duration-500 hover:border-primary/30">
              <div className="bg-surface-container flex items-center justify-between px-6 py-3 border-b border-outline-variant/10">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                </div>
                <span className="text-[9px] font-label font-black uppercase tracking-[0.3em] text-on-surface-variant/40">{codeLanguage || 'CODE'}</span>
              </div>
              <pre className="p-8 bg-[#0b0c10] overflow-x-auto custom-scrollbar">
                <code className="text-sm font-mono text-slate-300 leading-relaxed block whitespace-pre">
                  {currentBlock.join('\n')}
                </code>
              </pre>
            </div>
          );
          currentBlock = [];
          inCodeBlock = false;
        } else {
          // Open block
          inCodeBlock = true;
          codeLanguage = line.slice(3).toUpperCase();
        }
        continue;
      }

      if (inCodeBlock) {
        currentBlock.push(lines[i]);
        continue;
      }

      if (line === '') {
        elements.push(<div key={`space-${i}`} className="h-6" />);
        continue;
      }

      if (line.startsWith('# ')) {
        elements.push(<h1 key={i} className="text-4xl font-black text-on-surface mt-10 mb-6 uppercase tracking-tighter flex items-center gap-4 animate-in slide-in-from-left duration-500">{parseInline(line.replace('# ', ''))}</h1>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="text-2xl font-black text-on-surface mt-12 mb-6 uppercase tracking-tighter flex items-center gap-4"><div className="w-3 h-3 bg-primary rounded-sm rotate-45"></div>{parseInline(line.replace('## ', ''))}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="text-lg font-bold text-on-surface-variant mt-10 mb-4 tracking-widest uppercase flex items-center gap-3"><div className="w-1.5 h-1.5 bg-secondary rounded-full"></div>{parseInline(line.replace('### ', ''))}</h3>);
      } else if (line.startsWith('* ') || line.startsWith('- ')) {
        elements.push(
          <div key={i} className="flex gap-5 items-start ml-6 my-4 group transition-all duration-300">
            <div className="mt-1.5 flex flex-col items-center gap-1 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-primary text-base font-black">token</span>
            </div>
            <p className="flex-1 m-0 text-on-surface-variant leading-relaxed text-lg font-light group-hover:text-on-surface transition-colors">
              {parseInline(line.substring(2))}
            </p>
          </div>
        );
      } else {
        elements.push(<p key={i} className="m-0 text-on-surface-variant/80 font-light leading-loose text-lg">{parseInline(line)}</p>);
      }
    }

    return elements;
  };  const renderNotebook = () => {
    const wordCount = Array.isArray(notes) ? notes.reduce((acc, b) => acc + (b.type === 'text' ? b.content.replace(/<[^>]*>?/gm, '').trim().split(/\s+/).filter(Boolean).length : 0), 0) : 0;
    const readTime = Math.ceil(wordCount / 200);

    return (
      <div className={`flex flex-col bg-[#f8fafc] border-l border-slate-200 transition-all duration-700 lg:h-screen lg:sticky lg:top-0 ${showNotes ? 'fixed inset-0 z-[300] lg:relative lg:inset-auto opacity-100 flex-1 lg:min-w-[60%]' : 'w-0 opacity-0 overflow-hidden border-none'}`}>
        <div className="h-full flex flex-col relative">
          {/* Close button - overlay since editor has its own header */}
          <button 
                className="absolute top-3 right-4 z-[200] w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                onClick={() => setShowNotes(false)}
              >
                <span className="material-symbols-outlined text-base">close</span>
          </button>
          <div className="flex-grow overflow-y-auto custom-scrollbar flex flex-col items-center w-full">
              {activeGoal && (
                <MultimediaEditor 
                  key={activeGoal.id}
                  initialContent={notes}
                  onSave={(newNotes) => setNotes(newNotes)}

                  isSaving={isSaving}
                  user={user}
                  activeGoalTitle={activeGoal.title}
                />
              )}
          </div>
        </div>
      </div>
    );
  };

  const renderSideToolbar = () => (
    <button
      onClick={() => setShowNotes(true)}
      className={`fixed top-1/2 -translate-y-1/2 right-0 z-[200] w-12 h-24 bg-primary text-black rounded-l-[1rem] flex flex-col items-center justify-center transition-all duration-300 hover:w-16 shadow-[-10px_0_30px_rgba(253,184,19,0.2)] group overflow-hidden ${showNotes ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}`}
      title="Open Notebook"
    >
      <div className="absolute top-3 right-2 w-2 h-2 bg-secondary rounded-full animate-pulse border border-black/20 z-20"></div>
      <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform relative z-10">edit_note</span>
      <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
    </button>
  );

  const renderWorkbench = () => {
    return (
      <div className="flex flex-col lg:flex-row gap-8 h-full w-full mx-auto pb-24 animate-in slide-in-from-bottom-5 duration-700">
        <StudySidebar 
          showNotes={showNotes}
          roadmap={roadmap}
          activeTask={activeTask}
          handleSelectTask={handleSelectTask}
        />
        <div className="flex-1 min-w-0">
          <StudyWorkbenchMain
            activeTask={activeTask}
            handleStartLearning={handleStartLearning}
          />
        </div>
      </div>
    );
  };

  const renderLearningStatus = () => (
    <div className="flex items-center gap-6 px-4 py-3 rounded-2xl bg-surface-container/30 border border-outline-variant/10 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(253,184,19,1)]"></span>
        <span className="text-[10px] font-label font-black uppercase tracking-widest text-on-surface">Neural Sync</span>
      </div>
      <div className="h-4 w-[1px] bg-outline-variant/20"></div>
      <span className="text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant/60">{partTitle}</span>
    </div>
  );

  let phaseContent = null;

  if (phase === 'loading') {
    phaseContent = (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined text-primary text-6xl animate-pulse">menu_book</span>
          <p className="text-on-surface-variant font-label text-sm mt-4 uppercase tracking-widest italic">Initializing learning path...</p>
        </div>
      </div>
    );
  } else if (phase === 'select') {
    const passedParts = roadmap?.tasks?.flatMap(t => t.parts).filter(p => p.status === 'passed').length || 0;
    const totalParts = roadmap?.tasks?.flatMap(t => t.parts).length || 0;
    const progressPercent = totalParts > 0 ? Math.round((passedParts / totalParts) * 100) : 0;

    phaseContent = (
      <div className="animate-in fade-in duration-1000 max-w-6xl mx-auto w-full">
        <header className="mb-12 text-center relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-12 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none rounded-full"></div>
          
          <div className="flex flex-col items-center gap-6 relative z-10">
            {/* Neural Streak & Progress Indicator removed */}

             <div className="relative">
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-4 bg-surface-container-high text-on-surface border-2 border-outline-variant/10 hover:border-primary/50 hover:bg-surface-container-highest rounded-[2rem] px-10 py-5 transition-all group active:scale-95 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-sm">psychology</span>
                  </div>
                  <span className="text-xs sm:text-sm font-label tracking-[0.3em] uppercase font-black truncate max-w-[200px] sm:max-w-[400px]">
                    {activeGoal?.title || 'Unknown Synthesis'}
                  </span>
                  <span className={`material-symbols-outlined text-lg transition-all duration-500 ${dropdownOpen ? 'rotate-180 text-primary' : 'opacity-40'}`}>
                    expand_more
                  </span>
                </button>

                {dropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setDropdownOpen(false)}
                    ></div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-72 bg-surface-container-highest/90 backdrop-blur-2xl border border-outline-variant/20 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.6)] z-50 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                      <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <span className="text-[9px] font-label tracking-[0.4em] uppercase text-primary font-black">Neural Pathways</span>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-primary rounded-full animate-pulse"></div>
                          <div className="w-1 h-1 bg-primary rounded-full animate-pulse delay-75"></div>
                          <div className="w-1 h-1 bg-primary rounded-full animate-pulse delay-150"></div>
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar p-2">
                        {goals.filter(g => g.status === 'active').map(g => (
                          <button
                            key={g.id}
                            onClick={() => {
                              setSelectedGoalId(g.id);
                              setDropdownOpen(false);
                              setPhase('loading');
                              activeTaskRef.current = false;
                            }}
                            className={`w-full text-left px-6 py-5 rounded-2xl text-[10px] font-label tracking-[0.2em] uppercase font-bold transition-all flex items-center gap-4 mb-1 ${activeGoal?.id === g.id ? 'bg-primary text-on-primary-container shadow-lg' : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'}`}
                          >
                            <span className={`material-symbols-outlined text-base ${activeGoal?.id === g.id ? 'text-on-primary-container' : 'opacity-30'}`}>{activeGoal?.id === g.id ? 'verified' : 'radio_button_unchecked'}</span>
                            <span className="truncate">{g.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
             </div>
          </div>
        </header>

        {error && (
          <div className="mb-10 p-6 bg-error/5 border border-error/20 rounded-3xl max-w-2xl mx-auto backdrop-blur-md animate-in slide-in-from-top-4">
             <div className="flex items-center gap-4 justify-center">
                <span className="material-symbols-outlined text-error">warning</span>
                <p className="text-error text-[10px] font-label font-black text-center tracking-[0.2em] uppercase">{error}</p>
             </div>
          </div>
        )}

        {!activeTask && !roadmap ? (
          <div className="text-center py-20 bg-surface-container-low/30 rounded-3xl border border-outline-variant/10 text-on-surface-variant/40 italic font-label text-sm tracking-widest uppercase">
            Calibrating mastery protocols...
          </div>
        ) : (
          renderWorkbench()
        )}
      </div>
    );
  } else if (phase === 'learning' && learningContent) {
    phaseContent = (
      <div className="animate-in slide-in-from-bottom-10 duration-1000 max-w-4xl mx-auto w-full relative">
        <div className="absolute top-0 right-0 -translate-y-20 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-[200px] text-primary">auto_stories</span>
        </div>
        
        <header className="mb-12 flex items-end justify-between border-b border-outline-variant/10 pb-8 relative z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-primary/10 rounded-lg text-[9px] font-label tracking-[0.4em] text-primary uppercase font-black border border-primary/20">Module Sync Active</span>
                <span className="text-[10px] font-label tracking-[0.2em] text-on-surface-variant/40 uppercase font-black italic">Reading Protocol v4.0</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black font-headline text-on-surface uppercase tracking-tighter leading-none mt-2">{partTitle}</h2>
          </div>
          <button 
            onClick={() => setPhase('select')} 
            className="group flex flex-col items-center gap-2"
          >
            <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:bg-error group-hover:text-white transition-all duration-500 group-hover:rotate-90 shadow-xl border border-white/5">
              <span className="material-symbols-outlined text-2xl">close</span>
            </div>
            <span className="text-[8px] font-label tracking-[0.3em] uppercase opacity-0 group-hover:opacity-100 transition-opacity font-black text-error">Disconnect</span>
          </button>
        </header>

        <div className="bg-surface-container-low/40 backdrop-blur-3xl border border-white/5 rounded-[3rem] p-6 sm:p-12 md:p-16 shadow-[0_50px_100px_rgba(0,0,0,0.4)] relative transition-all duration-700 hover:border-primary/20 overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
          
          <div className="max-w-none prose-custom">
             {renderParsedContent(learningContent)}
          </div>

          <div className="mt-24 pt-12 border-t border-white/5 flex flex-col items-center relative overflow-hidden">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/5 blur-3xl -translate-y-32 rounded-full"></div>
             
             <div className="flex items-center gap-4 mb-10 opacity-40">
                <div className="w-10 h-[1px] bg-outline-variant"></div>
                <span className="text-[9px] font-label text-on-surface-variant uppercase tracking-[0.4em] font-black italic">Neural integrity verification required</span>
                <div className="w-10 h-[1px] bg-outline-variant"></div>
             </div>

            {roadmap?.tasks?.flatMap(t => t.parts).find(p => p.id === activePartId)?.status === 'passed' ? (
              <button
                onClick={() => setPhase('select')}
                className="group relative px-20 py-7 bg-surface-container-highest/50 backdrop-blur-md rounded-full overflow-hidden transition-all duration-500 active:scale-95 border border-white/10 hover:bg-surface-container-highest"
              >
                <span className="relative font-label font-black tracking-[0.6em] text-on-surface text-lg uppercase flex items-center gap-4">
                   <span className="material-symbols-outlined text-secondary">verified</span>
                   Return to Hub
                </span>
              </button>
            ) : (
              <button
                onClick={handleStartQuiz}
                className="group relative px-20 py-7 bg-primary rounded-full overflow-hidden transition-all duration-700 active:scale-95 shadow-[0_20px_60px_rgba(253,184,19,0.4)] hover:shadow-primary/60 hover:scale-105"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
                <span className="relative font-label font-black tracking-[0.6em] text-on-primary-container text-lg uppercase flex items-center gap-4">
                   Initiate Assessment
                   <span className="material-symbols-outlined group-hover:translate-x-2 transition-transform">bolt</span>
                </span>
              </button>
            )}
            
            <p className="mt-8 text-[8px] font-label uppercase tracking-[0.5em] text-on-surface-variant/20 font-black">Authorized Session Only</p>
          </div>
        </div>
      </div>
    );
  } else if (phase === 'quiz' && quizData) {
    const q = quizData[currentQ];
    phaseContent = (
      <div className="animate-in fade-in duration-1000 max-w-5xl mx-auto w-full flex flex-col items-center">
        <section className="w-full mb-20 space-y-6 text-center">
          <div className="flex flex-col items-center gap-3">
             <span className="font-label text-primary text-[11px] tracking-[0.5em] font-black uppercase bg-primary/10 px-4 py-1.5 rounded-full">Verification Protocol Q{currentQ + 1}/{quizData.length}</span>
             <div className="w-48 h-1 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((currentQ + 1) / quizData.length) * 100}%` }}></div>
             </div>
          </div>
          <h1 className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tighter text-on-surface leading-tight max-w-4xl mx-auto">{q.question}</h1>
        </section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-20">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelectOption(i)}
              className={`p-5 sm:p-10 bg-surface-container-low hover:bg-surface-container text-left transition-all duration-300 border-2 rounded-2xl sm:rounded-[2rem] relative group active:scale-[0.98] ${selectedOption === i ? 'border-primary shadow-[0_0_40px_rgba(253,184,19,0.15)] bg-primary/5' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
                <div className="flex items-center gap-6">
                    <div className={`w-12 h-12 flex items-center justify-center rounded-xl font-black text-lg transition-all ${selectedOption === i ? 'bg-primary text-on-primary-container' : 'bg-surface-container-highest text-on-surface-variant group-hover:bg-primary/20 group-hover:text-primary'}`}>
                        {String.fromCharCode(65 + i)}
                    </div>
                    <span className="text-lg font-medium leading-relaxed">{opt}</span>
                </div>
            </button>
          ))}
        </div>
        <div className="pb-32">
            <button
                onClick={handleNext}
                disabled={selectedOption === null || loading}
                className="px-16 py-6 bg-gradient-to-br from-primary to-secondary rounded-full font-label font-black tracking-[0.4em] text-on-primary-container text-lg uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:grayscale"
            >
                {currentQ + 1 < quizData.length ? 'Next Question' : 'Seal Submission'}
            </button>
        </div>
      </div>
    );
  } else if (phase === 'result' && result) {
    phaseContent = (
      <div className="animate-in zoom-in duration-1000 max-w-2xl mx-auto w-full flex flex-col items-center justify-center min-h-[70vh] pb-32">
        <div className={`w-40 h-40 rounded-[2.5rem] flex items-center justify-center mb-12 shadow-[0_30px_70px_rgba(0,0,0,0.5)] bg-gradient-to-br transition-all duration-1000 ${result.is_passed ? 'from-primary to-secondary rotate-[360deg]' : 'from-error to-error-container'}`}>
          <span className="material-symbols-outlined text-white text-7xl">{result.is_passed ? 'military_tech' : 'restart_alt'}</span>
        </div>
        <div className="text-center mb-16">
            <h2 className="text-5xl font-black font-headline uppercase mb-4 tracking-tighter">{result.is_passed ? 'Integrity Verified' : 'Sync Incomplete'}</h2>
            <div className="flex items-center justify-center gap-4">
                <div className="h-[1px] w-12 bg-outline-variant/30"></div>
                <p className="text-2xl font-headline italic tracking-widest uppercase opacity-60">Mastery: <span className="font-black text-primary not-italic">{result.score_percent}%</span></p>
                <div className="h-[1px] w-12 bg-outline-variant/30"></div>
            </div>
        </div>
        <button onClick={() => { setPhase('select'); refreshData(); }} className="px-14 py-6 rounded-full bg-primary text-on-primary-container font-label text-sm font-black uppercase tracking-[0.4em] shadow-xl hover:scale-105 active:scale-95 transition-all">
          {result.is_passed ? 'Continue Path' : 'Retry Protocol'}
        </button>
      </div>
    );
  }

  return (
    <div className={`transition-all duration-700 ease-in-out w-full ${showNotes ? 'h-[85vh] sm:h-[90vh] bg-surface-container-lowest/80 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden z-20 relative' : 'min-h-screen relative'}`}>
      {renderLoaders()}
      
      <div className={`flex w-full h-full relative ${showNotes ? 'flex-1 overflow-hidden' : ''}`}>
        <main className={`flex-1 transition-all duration-700 ease-in-out h-full overflow-y-auto custom-scrollbar ${showNotes ? 'pr-2' : ''}`}>
          <div className={`w-full mx-auto px-3 sm:px-10 py-4 lg:py-6 ${showNotes ? 'p-4 sm:p-6' : ''}`}>
             {phaseContent}
          </div>
        </main>
        {renderNotebook()}
      </div>

      {renderSideToolbar()}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(253, 184, 19, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(253, 184, 19, 0.2); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,700;1,400&display=swap');
        .font-serif { font-family: 'Crimson Pro', serif; }
        .neural-editor:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          display: block;
          opacity: 0.5;
        }
        .neural-editor h1 { font-size: 2.5rem; font-weight: 900; margin-top: 2rem; margin-bottom: 1rem; color: #0f172a; }
        .neural-editor ul { list-style-type: disc; margin-left: 1.5rem; margin-top: 1rem; }
        .neural-editor b, .neural-editor strong { font-weight: 800; color: #0f172a; }
        .neural-editor i, .neural-editor em { font-style: italic; }
      `}</style>
    </div>
  );
};

export default Study;
