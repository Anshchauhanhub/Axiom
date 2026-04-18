import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register, login, onboardingChat, finalizeGoal, quickActivateGoal, activateGoal, deleteGoal, toggleGoalStatus, getChatHistory } from '../services/api';
import { useData } from '../context/DataContext';
import NeuralLoader from '../components/NeuralLoader';
import MessageBubble from '../components/MessageBubble';
import { Send, Zap, ChevronRight, Activity, Trash2, Play, Pause, History, BrainCircuit, Search } from 'lucide-react';

const Onboarding = () => {
  const { user, loginUser } = useAuth();
  const { goals, refreshData } = useData();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auth state
  const [authStep, setAuthStep] = useState(!user);
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Chat state
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [phase, setPhase] = useState('discovery');
  const [draftRoadmap, setDraftRoadmap] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const loadHistory = async () => {
      if (user) {
        setLoading(true);
        try {
          const res = await getChatHistory();
          if (res.messages && res.messages.length > 0) {
            setMessages(res.messages);
          } else {
            // Only set initial greeting if NO history exists
            setMessages([{ 
              role: 'assistant', 
              content: "Welcome to Axiom. I am your high-accountability coach. To build your optimal neural path, tell me: Are you currently in college, preparing for entrances, or focused on job mastery?" 
            }]);
          }
        } catch (e) {
          console.error("Failed to load history:", e);
        } finally {
          setLoading(false);
        }
        setAuthStep(false);
      }
    };
    loadHistory();
  }, [user]);

  // Auto-scroll whenever messages change or typing indicator appears
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Also observe DOM mutations inside the chat container for any dynamic content changes
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new MutationObserver(() => {
      scrollToBottom();
    });

    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const fn = mode === 'register' ? register : login;
      const res = await fn(email, password);
      await loginUser(res.access_token);
    } catch (e) {
      if (mode === 'register' && e.message.includes('already registered')) {
        setError('This email is already part of the Axiom network. Switch to Login to continue.');
      } else {
        setError(e.message);
      }
    }
    setLoading(false);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMsg = { role: 'user', content: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const res = await onboardingChat([...messages, userMsg]);
      
      // Safely extract message — fallback if missing
      const fullMessage = res.message || "I'm preparing your learning path...";
      let displayedMessage = "";
      
      // Update phase and roadmap immediately as they are behind-the-scenes
      if (res.phase) setPhase(res.phase);
      if (res.draft_roadmap) setDraftRoadmap(res.draft_roadmap);

      // Clear any previous errors on success
      setError('');

      // Create a placeholder assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: "", phase: res.phase || phase }]);

      const tokens = fullMessage.split(/(\s+)/);
      for (let i = 0; i < tokens.length; i++) {
        displayedMessage += tokens[i];
        
        // Update the last message in the history
        setMessages(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = { ...newHistory[newHistory.length - 1], content: displayedMessage };
          return newHistory;
        });

        // Small delay if the token is descriptive text (not just spaces)
        if (tokens[i].trim()) {
          await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
        }
      }
      
    } catch (e) {
      console.error('Onboarding chat error:', e);
      setError("Neural link interrupted. Please retry.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleToggleStatus = async (goalId) => {
    setLoading(true);
    try {
      await toggleGoalStatus(goalId);
      await refreshData();
      // If we activated it, navigate to home. If we paused it, stay here.
      // We can check the actual state if we want, but for now let's just refresh.
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm("Permanently purge this neural path? This cannot be undone.")) return;
    setLoading(true);
    try {
      await deleteGoal(goalId);
      await refreshData();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!draftRoadmap) return;
    setLoading(true);
    try {
      const title = draftRoadmap[0]?.title || "My Mastery Goal";
      await finalizeGoal(title, draftRoadmap);
      await refreshData();
      navigate('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = () => {
    setPhase('refinement');
    setError('');
    // Optionally scroll to input
    scrollToBottom();
  };

  const handleSwitchGoal = async (id) => {
    setLoading(true);
    try {
      await activateGoal(id);
      await refreshData();
      navigate('/');
    } catch (e) {
      setError("Failed to switch neural path.");
    } finally {
      setLoading(false);
    }
  };

  if (authStep) {
    return (
      <div className="w-full max-w-md mx-auto mt-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary/20">
            <span className="material-symbols-outlined text-primary text-3xl">neurology</span>
          </div>
          <h2 className="text-3xl font-black font-headline uppercase tracking-tighter text-on-surface">Initialize Session</h2>
        </div>
        <form onSubmit={handleAuth} className="space-y-6 bg-surface-container-low p-8 rounded-[2rem] border border-outline-variant/10 shadow-2xl">
          <div className="space-y-2">
            <label className="text-[10px] font-label font-bold text-primary uppercase tracking-widest ml-1">Email Identifier</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-surface-container-highest border-none rounded-2xl text-on-surface focus:ring-2 focus:ring-primary/50 transition-all font-label text-sm"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-label font-bold text-primary uppercase tracking-widest ml-1">Security Key</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-surface-container-highest border-none rounded-2xl text-on-surface focus:ring-2 focus:ring-primary/50 transition-all font-label text-sm"
              required
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </div>
          {error && <p className="text-error text-xs font-bold font-label text-center">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-5 bg-primary text-on-primary-container font-label font-bold text-xs tracking-widest uppercase rounded-2xl shadow-xl">
            {loading ? 'Processing...' : mode.toUpperCase()}
          </button>
          <div className="text-center pt-4">
            <button type="button" onClick={() => setMode(mode === 'register' ? 'login' : 'register')} className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest hover:text-primary">
              {mode === 'register' ? 'Switch to Login' : 'Switch to Register'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 min-h-[500px] flex flex-col lg:flex-row gap-6 animate-in fade-in duration-1000">
      {loading && (
        <NeuralLoader 
          message="SYNTHESIZING NEURAL PATH" 
          subMessages={[
            'Scanning global repositories',
            'Calibrating neural roadmap',
            'Tapping into node archives',
            'Finalizing pathway synthesis',
            'Synchronizing bio-locked records',
          ]}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-surface-container-low/30 rounded-[2.5rem] border border-outline-variant/10 overflow-hidden relative backdrop-blur-sm">

        {/* Chat Header */}
        <div className="w-full p-6 flex justify-between items-center border-b border-outline-variant/10 bg-surface-container-low/50 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 neural-glow">
              <BrainCircuit className="text-primary" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="h-2 w-2 rounded-full bg-secondary animate-pulse shadow-[0_0_10px_rgba(0,179,89,0.5)]"></span>
                <span className="font-label text-[10px] tracking-[0.3em] text-secondary uppercase font-bold">Neural Link Active</span>
              </div>
              <h2 className="text-xl font-black font-headline uppercase tracking-tighter text-on-surface">Axiom Coach</h2>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-label uppercase text-on-surface-variant/40 tracking-widest mb-1">Process Phase</span>
            <div className="px-3 py-1 bg-surface-container-highest rounded-full border border-outline-variant/20 shadow-inner">
               <span className="text-[10px] font-label font-black text-primary uppercase tracking-[0.2em]">{phase}</span>
            </div>
          </div>
        </div>

        {/* Message Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-8 py-8 space-y-4 custom-scrollbar"
        >
          {messages.map((m, i) => (
            <MessageBubble 
              key={i} 
              message={m.content} 
              role={m.role} 
              phase={m.role === 'assistant' ? (m.phase || phase) : null} 
            />
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-surface-container-lowest border border-outline-variant/10 p-5 rounded-[1.5rem] rounded-tl-none">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}

          {/* Draft Roadmap Display — only show once we reach draft phase */}
          {draftRoadmap && (phase === 'draft' || phase === 'refinement' || phase === 'ready') && (
            <div className="w-full mt-12 animate-in zoom-in duration-700">
              <div className="bg-gradient-to-br from-[#0e0e10] to-[#1c1b1d] border border-primary/30 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5">
                  <span className="material-symbols-outlined text-[120px]">neurology</span>
                </div>

                <header className="mb-10 relative z-10">
                  <span className="font-label text-[10px] tracking-[0.3em] text-primary uppercase font-bold bg-primary/10 px-3 py-1 rounded-full border border-primary/20">Proposed Learning Path</span>
                  <h3 className="text-4xl font-black font-headline uppercase mt-4 tracking-tighter italic">Synthesis Draft</h3>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 mb-12">
                  {draftRoadmap.map((task, tidx) => (
                    <div key={tidx} className="p-6 bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl hover:border-primary/30 transition-all group">
                      <h4 className="font-bold text-sm text-primary mb-3 uppercase tracking-wide flex items-center gap-2">
                        <span className="text-[10px] opacity-40">0{tidx + 1}</span>
                        {task.title || task}
                      </h4>
                      <ul className="space-y-2">
                        {(Array.isArray(task.parts) ? task.parts : []).slice(0, 3).map((p, pidx) => (
                          <li key={pidx} className="flex items-center gap-3 text-xs text-on-surface-variant font-light">
                            <span className="w-1 h-1 bg-primary/40 rounded-full"></span>
                            {typeof p === 'string' ? p : p?.title || String(p)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {draftRoadmap && phase !== 'discovery' && phase !== 'timeline' && phase !== 'syllabus' && (
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-4 relative z-10 pt-6 border-t border-outline-variant/10">
                    <button
                      onClick={handleFinalize}
                      className="group relative px-10 py-5 bg-primary text-on-primary-container rounded-full overflow-hidden transition-all duration-300 active:scale-95 shadow-2xl shadow-primary/40 w-full sm:w-auto"
                    >
                      <span className="relative z-10 font-label font-bold tracking-[0.4em] uppercase text-xs">Activate Neural Path</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-secondary to-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </button>
                    
                    <button
                      onClick={handleRefine}
                      className="px-10 py-5 bg-surface-container-highest/50 text-on-surface-variant hover:text-primary border border-outline-variant/20 rounded-full font-label font-bold tracking-[0.3em] uppercase text-[10px] transition-all hover:bg-primary/5 hover:border-primary/30 w-full sm:w-auto"
                    >
                      Refine Path
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dummy element for scroll-to-bottom anchor */}
          <div ref={messagesEndRef} className="h-4 w-full opacity-0 pointer-events-none" />

        </div>

        {/* Chat Input */}
        <div className="p-8 border-t border-outline-variant/10 bg-surface-container-low/50">
          <form onSubmit={handleSendMessage} className="relative group max-w-4xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isTyping}
                placeholder={phase === 'ready' ? "Neural path locked. Click 'Refine Path' to modify." : "Respond to Axiom..."}
                className="w-full bg-surface-container-lowest/80 border border-outline-variant/20 rounded-2xl px-8 py-5 pr-20 text-on-surface text-sm font-light focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none transition-all shadow-2xl disabled:opacity-50 placeholder:text-on-surface-variant/30"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isTyping || phase === 'ready'}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-primary text-on-primary-container rounded-xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-20 shadow-lg shadow-primary/20 hover:brightness-110 group-hover:neural-glow"
              >
                {isTyping ? <Activity size={20} className="animate-pulse" /> : <Send size={20} />}
              </button>
            </div>

            {/* Quick Suggestions */}
            {phase === 'discovery' && messages.length <= 2 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {['College Student', 'Preparing for Exam', 'Career Mastery'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInputText(s)}
                    className="px-4 py-1.5 rounded-xl border border-outline-variant/10 bg-surface-container-lowest text-[10px] font-label font-bold text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all uppercase tracking-widest"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </form>
          {error && <p className="text-error text-[10px] font-label font-bold uppercase tracking-widest text-center mt-4 animate-bounce">{error}</p>}
        </div>
      </div>

      {/* Side Panel: Neural Archive */}
      <aside className="w-full lg:w-80 flex flex-col gap-6 animate-in slide-in-from-right-8 duration-700">
        <div className="h-full bg-surface-container-low/30 rounded-[2.5rem] border border-outline-variant/10 p-8 flex flex-col backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-30"></div>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <span className="material-symbols-outlined text-primary text-xl">history</span>
            </div>
            <div>
              <h3 className="font-headline font-black text-xs uppercase tracking-tighter">Neural Archive</h3>
              <p className="text-[9px] font-label text-on-surface-variant uppercase tracking-widest opacity-40">Previous Goals</p>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {goals.length === 0 ? (
              <div className="text-center py-12 opacity-30">
                <span className="material-symbols-outlined text-4xl mb-2">folder_open</span>
                <p className="text-[10px] font-label uppercase tracking-widest">Archive Empty</p>
              </div>
            ) : (
              goals.map((goal) => (
                <div key={goal.id} className={`group p-4 rounded-2xl border transition-all cursor-default relative overflow-hidden ${goal.status === 'active'
                    ? 'bg-primary/5 border-primary/30 shadow-[0_0_20px_rgba(77,142,255,0.05)]'
                    : 'bg-surface-container-lowest/50 border-outline-variant/10 opacity-70 hover:opacity-100'
                  }`}>
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-[12px] font-bold text-on-surface uppercase tracking-tight line-clamp-1 pr-2">
                      {goal.title}
                    </h4>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-on-surface-variant/40 hover:text-error transition-colors p-1 rounded-md"
                      title="Purge Path"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${goal.status === 'active' ? 'bg-primary animate-pulse' : 'bg-on-surface-variant'}`}></div>
                      <span className={`text-[8px] font-label font-bold uppercase tracking-widest ${goal.status === 'active' ? 'text-primary' : 'text-on-surface-variant opacity-40'}`}>
                        {goal.status}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleStatus(goal.id)}
                      className={`px-3 py-1.5 rounded-lg font-label font-bold text-[8px] tracking-widest uppercase transition-all flex items-center gap-1.5 ${goal.status === 'active'
                          ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                          : 'bg-surface-container-highest text-on-surface-variant hover:bg-primary/10 hover:text-primary border border-outline-variant/20'
                        }`}
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        {goal.status === 'active' ? 'pause' : 'play_arrow'}
                      </span>
                      {goal.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-outline-variant/10">
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
              <p className="text-[9px] text-on-surface-variant leading-relaxed italic opacity-60">
                Neural Archive suggests previous paths based on your learned patterns.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default Onboarding;
