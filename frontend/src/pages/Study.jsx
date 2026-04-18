import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startQuiz, submitQuiz, getPartContent, updateGoalNotes, createSocialPost } from '../services/api';
import { useData } from '../context/DataContext';
import NeuralLoader from '../components/NeuralLoader';
import MultimediaEditor from '../components/MultimediaEditor';

const Study = () => {
  const { user, refreshUser } = useAuth();
  const { goals, roadmap, loading: dataLoading, refreshData } = useData();
  const navigate = useNavigate();
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
  const timerRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    if (!user) { navigate('/onboarding'); return; }
    if (roadmap && goals) {
      let foundTask = null;
      let foundGoal = null;

      const primaryGoal = goals.find(g => g.status === 'active') || goals[0];
      
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
        setNotes(foundGoal.notes || []); 
      }
      
      // Fix: Only reset to 'select' if we are in the initial loading state.
      // This prevents refreshData() calls from kicking the user out of the Result or Learning phases.
      if (phase === 'loading') {
        setPhase('select');
      }
    }
  }, [user, roadmap, goals, navigate, phase, activeGoal?.id]);

  useEffect(() => {
    if (!activeGoal || !showNotes) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      // Use JSON.stringify for a deep comparison since notes is an array of objects
      if (JSON.stringify(notes) === JSON.stringify(activeGoal.notes)) return;
      setIsSaving(true);
      try {
        await updateGoalNotes(activeGoal.id, notes);
        activeGoal.notes = notes; 
      } catch (e) {
        console.error('Failed to save notes:', e);
      } finally {
        setIsSaving(false);
      }
    }, 2000);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [notes, activeGoal, showNotes]);

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

  const handleExecCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setNotes(editorRef.current.innerHTML);
    }
  };

  const handleContentChange = () => {
    if (editorRef.current) {
      setNotes(editorRef.current.innerHTML);
    }
  };

  const handleAddLink = () => {
    const url = prompt('Enter the URL:');
    if (url) handleExecCommand('createLink', url);
  };

  const handleShare = async () => {
    if (!notes || !Array.isArray(notes)) return;
    setLoading(true);
    try {
      await createSocialPost({
        goal_id: activeGoal?.id,
        content: { blocks: notes },
        post_type: 'lesson'
      });
      alert('🚀 Shared to Axiom Social!');
    } catch (e) {
      console.error(e);
      alert('Failed to share: ' + e.message);
    } finally {
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
          SYNTHESIZED BY AXIOM AI // ${date} // ${user?.name || 'Neural Subject'}
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
    link.download = `${title.replace(/\s+/g, '_')}_Synthesis.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderLoaders = () => (
    <>
      {loadingQuiz && (
        <NeuralLoader
          message="SYNTHESIZING VERIFICATION"
          subMessages={[
            'Creating custom neural challenge',
            'Calibrating knowledge depth',
            'Tapping into node repositories',
            'Preparing verification parameters',
            'Finalizing neural synthesis',
          ]}
        />
      )}
      {submittingQuiz && (
        <NeuralLoader
          message="NEURAL EVALUATION"
          subMessages={[
            'Analyzing neural responses',
            'Computing mastery score',
            'Validating knowledge integrity',
            'Generating final performance record',
            'Updating neural archives',
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
                <span className="text-[9px] font-label font-black uppercase tracking-[0.3em] text-on-surface-variant/40">{codeLanguage || 'SYNTAX'}</span>
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
      <div className={`flex flex-col bg-[#f8fafc] border-l border-slate-200 transition-all duration-700 h-screen sticky top-0 ${showNotes ? 'opacity-100 flex-1 min-w-[60%]' : 'w-0 opacity-0 overflow-hidden border-none'}`}>
        <div className="h-full flex flex-col relative">
          {/* Close button - overlay since editor has its own header */}
          <button 
                className="absolute top-3 right-6 z-[200] w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
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
                  onShare={handleShare}
                  isSaving={isSaving}
                  user={user}
                />
              )}
          </div>
        </div>
      </div>
    );
  };

  const renderNotesToggle = () => (
    <button
      onClick={() => setShowNotes(!showNotes)}
      className={`fixed bottom-10 right-10 z-[200] w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 shadow-[0_20px_50px_rgba(253,184,19,0.3)] ${
        showNotes ? 'bg-error text-white scale-0 rotate-180 opacity-0 pointer-events-none' : 'bg-primary text-on-primary-container hover:scale-110 active:scale-95 glow-gold'
      }`}
    >
      <span className="material-symbols-outlined text-3xl">
        {showNotes ? 'close' : 'description'}
      </span>
      {!showNotes && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-secondary rounded-full border-[3px] border-background animate-pulse"></div>
      )}
    </button>
  );

  const renderTaskParts = (task) => (
    <div className="space-y-12 max-w-4xl mx-auto pb-24">
      <div className="bg-surface-container-low border border-outline-variant/10 p-12 lg:p-16 rounded-[3.5rem] relative overflow-hidden group shadow-2xl transition-all duration-500 hover:border-primary/20">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
          <span className="material-symbols-outlined text-8xl">neuroscience</span>
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-[1px] bg-primary"></div>
              <h3 className="text-4xl font-black font-headline text-on-surface uppercase tracking-tighter leading-none">
                {task.title}
              </h3>
            </div>
            <button 
              onClick={() => setViewMode('roadmap')}
              className="px-6 py-2 rounded-full border border-outline-variant/20 text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-highest transition-all"
            >
              Back to Roadmap
            </button>
          </div>
          <div className="space-y-6 relative">
            <div className="absolute left-[34px] top-4 bottom-4 w-[1px] bg-gradient-to-b from-primary/40 via-secondary/40 to-transparent"></div>
            {task.parts.map((part) => {
              const isActive = part.status === 'active';
              const isPassed = part.status === 'passed';
              
              return (
                <div 
                  key={part.id} 
                  className={`relative flex items-center justify-between p-7 rounded-[2rem] border transition-all duration-300 ml-16 ${(isActive || isPassed) ? 'bg-surface-container-highest/20 border-primary/40 cursor-pointer hover:bg-surface-container-highest/40 hover:scale-[1.03] shadow-lg' : 'opacity-20 border-outline-variant/5 grayscale'}`}
                  onClick={() => (isActive || isPassed) && handleStartLearning(part.id, part.title)}
                >
                  <div className={`absolute left-[-42px] w-6 h-6 rounded-full border-4 border-surface-container-low z-20 transition-all duration-500 ${isActive ? 'bg-primary shadow-[0_0_15px_rgba(253,184,19,0.5)] animate-pulse' : isPassed ? 'bg-secondary' : 'bg-outline-variant/30'}`}></div>
                  <div className="flex items-center gap-6">
                    <div className={`w-12 h-12 flex items-center justify-center rounded-xl bg-surface-container-highest/50 ${isActive ? 'text-primary' : isPassed ? 'text-secondary' : 'text-on-surface-variant'}`}>
                       <span className="material-symbols-outlined text-2xl">{isActive ? 'bolt' : isPassed ? 'verified' : 'lock'}</span>
                    </div>
                    <div>
                      <span className={`block text-lg font-bold tracking-tight mb-0.5 ${isActive || isPassed ? 'text-on-surface' : 'text-on-surface-variant'}`}>{part.title}</span>
                      <span className={`text-[9px] font-label tracking-[0.2em] font-black uppercase ${isActive ? 'text-primary' : isPassed ? 'text-secondary' : 'text-on-surface-variant/40'}`}>{part.status}</span>
                    </div>
                  </div>
                  {(isActive || isPassed) && <span className="material-symbols-outlined text-primary group-secondary:translate-x-1 transition-transform">arrow_forward_ios</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const renderRoadmapOverview = () => (
    <div className="animate-in fade-in duration-700 max-w-5xl mx-auto w-full pb-24">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roadmap.tasks.map((task, idx) => {
          const isLocked = task.status === 'locked';
          const isActive = task.status === 'active';
          const isPassed = task.status === 'passed';
          
          return (
            <div 
              key={task.id} 
              onClick={() => !isLocked && handleSelectTask(task)}
              className={`p-8 rounded-[2.5rem] border transition-all duration-500 flex flex-col justify-between group h-64 ${
                !isLocked ? 'bg-surface-container-low border-outline-variant/10 cursor-pointer hover:border-primary/40 hover:bg-surface-container-high' : 'bg-surface-container-low/50 border-transparent opacity-40'
              }`}
            >
              <div>
                 <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                      isActive ? 'bg-primary/20 text-primary shadow-[0_0_20px_rgba(253,184,19,0.2)]' : isPassed ? 'bg-secondary/20 text-secondary' : 'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                      <span className="material-symbols-outlined text-3xl">
                        {isPassed ? 'verified' : isActive ? 'play_arrow' : 'lock'}
                      </span>
                    </div>
                    <span className="text-[10px] font-label font-black text-on-surface-variant/20 group-hover:text-primary/40 transition-colors uppercase tracking-[0.3em]">Module {String(idx + 1).padStart(2, '0')}</span>
                 </div>
                 <h4 className="text-xl font-headline font-black uppercase tracking-tight text-on-surface mb-2 leading-none">{task.title}</h4>
                 <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant opacity-60">
                   {task.parts.filter(p => p.status === 'passed').length} / {task.parts.length} Nodes Verified
                 </p>
              </div>
              
              <div className="mt-6 flex items-center justify-between">
                 <span className={`text-[9px] font-label font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${
                    isActive ? 'bg-primary text-on-primary-container' : isPassed ? 'bg-secondary/20 text-secondary' : 'bg-surface-container-highest text-on-surface-variant'
                 }`}>
                   {task.status}
                 </span>
                 {!isLocked && <span className="material-symbols-outlined text-primary scale-0 group-hover:scale-100 transition-transform">open_in_new</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  let phaseContent = null;

  if (phase === 'loading') {
    phaseContent = (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined text-primary text-6xl animate-pulse">quiz</span>
          <p className="text-on-surface-variant font-label text-sm mt-4 uppercase tracking-widest italic">Initializing neuro-pathways...</p>
        </div>
      </div>
    );
  } else if (phase === 'select') {
    phaseContent = (
      <div className="animate-in fade-in duration-1000 max-w-6xl mx-auto w-full">
        <header className="mb-12 text-center">
          <span className="text-primary font-label text-[10px] tracking-[0.4em] uppercase font-bold mb-3 block animate-in slide-in-from-top-4 duration-700">Neural Gateway</span>
          <h2 className="text-5xl font-black tracking-tighter text-on-surface mb-4 font-headline uppercase leading-none">
            {viewMode === 'task' ? 'Study Session' : 'Roadmap Overview'}
          </h2>
          <div className="flex items-center justify-center gap-4">
             <div className="h-[1px] w-8 bg-outline-variant/30"></div>
            <span className="text-[11px] font-label tracking-[0.3em] uppercase text-on-surface-variant font-black opacity-40 italic">{activeGoal?.title || 'Unknown Synthesis'}</span>
            <div className="h-[1px] w-8 bg-outline-variant/30"></div>
          </div>
        </header>

        {error && (
          <div className="mb-10 p-5 bg-error-container/10 border border-error/20 rounded-2xl max-w-2xl mx-auto backdrop-blur-sm">
            <p className="text-error text-xs font-label font-bold text-center tracking-widest">{error}</p>
          </div>
        )}

        {!activeTask && !roadmap ? (
          <div className="text-center py-20 bg-surface-container-low/30 rounded-3xl border border-outline-variant/10 text-on-surface-variant/40 italic font-label text-sm tracking-widest uppercase">
            Calibrating mastery protocols...
          </div>
        ) : (
          viewMode === 'task' && activeTask ? renderTaskParts(activeTask) : renderRoadmapOverview()
        )}
      </div>
    );
  } else if (phase === 'learning' && learningContent) {
    phaseContent = (
      <div className="animate-in slide-in-from-bottom-10 duration-1000 max-w-4xl mx-auto w-full">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className="w-6 h-[1px] bg-primary"></span>
                <span className="text-[9px] font-label tracking-[0.3em] text-primary uppercase font-black">Neural Documentation</span>
            </div>
            <h2 className="text-4xl font-black font-headline text-on-surface uppercase tracking-tighter leading-none">{partTitle}</h2>
          </div>
          <button onClick={() => setPhase('select')} className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-all duration-300 hover:rotate-90">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </header>

        <div className="bg-surface-container-low border border-outline-variant/10 rounded-[2.5rem] p-10 md:p-14 shadow-2xl relative transition-all duration-500 hover:border-primary/10">
          <div className="max-w-none text-on-surface-variant/80 font-light leading-relaxed text-lg">
             {renderParsedContent(learningContent)}
          </div>
          <div className="mt-20 pt-10 border-t border-outline-variant/10 flex flex-col items-center">
             <span className="text-[10px] font-label text-on-surface-variant/30 uppercase tracking-[0.3em] mb-8 italic text-center">Neural integrity verification required for progression</span>
            {roadmap?.tasks?.flatMap(t => t.parts).find(p => p.id === activePartId)?.status === 'passed' ? (
              <button
                onClick={() => setPhase('select')}
                className="group relative px-16 py-6 bg-surface-container-highest rounded-full overflow-hidden transition-all duration-500 active:scale-95 shadow-xl hover:bg-surface-container"
              >
                <span className="relative font-label font-black tracking-[0.5em] text-on-surface text-lg uppercase">BACK TO TASK</span>
              </button>
            ) : (
              <button
                onClick={handleStartQuiz}
                className="group relative px-16 py-6 bg-gradient-to-br from-primary via-primary to-secondary rounded-full overflow-hidden transition-all duration-500 active:scale-95 shadow-[0_20px_50px_rgba(253,184,19,0.3)] hover:shadow-primary/40"
              >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative font-label font-black tracking-[0.5em] text-on-primary-container text-lg uppercase">TAKE QUIZ</span>
              </button>
            )}
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
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-on-surface leading-tight max-w-4xl mx-auto">{q.question}</h1>
        </section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-20">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelectOption(i)}
              className={`p-10 bg-surface-container-low hover:bg-surface-container text-left transition-all duration-300 border-2 rounded-[2rem] relative group active:scale-[0.98] ${selectedOption === i ? 'border-primary shadow-[0_0_40px_rgba(253,184,19,0.15)] bg-primary/5' : 'border-transparent opacity-60 hover:opacity-100'}`}
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
    <div className={`transition-all duration-700 ease-in-out min-h-screen ${showNotes ? 'fixed inset-0 z-[100] bg-[#08090b] flex flex-col overflow-hidden' : 'relative'}`}>
      {renderLoaders()}
      
      <div className={`flex w-full h-full relative ${showNotes ? 'flex-1 overflow-hidden' : ''}`}>
        <main className={`flex-1 transition-all duration-700 ease-in-out h-full overflow-y-auto custom-scrollbar ${showNotes ? 'pr-2' : ''}`}>
          <div className={`max-w-[1400px] mx-auto px-10 py-8 lg:py-12 ${showNotes ? 'p-8' : ''}`}>
             {phaseContent}
          </div>
        </main>
        {renderNotebook()}
      </div>

      {renderNotesToggle()}
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
