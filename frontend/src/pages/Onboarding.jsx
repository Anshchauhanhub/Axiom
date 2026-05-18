import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  onboardingChat, finalizeGoal, 
  clearChatHistory, generateYoutubeRoadmap 
} from '../services/api';
import { useData } from '../context/DataContext';
import NeuralLoader from '../components/NeuralLoader';
import MessageBubble from '../components/MessageBubble';
import { 
  Send, Activity, ChevronRight, History, 
  BrainCircuit, Search, Video, MessageSquare, 
  ArrowRight, Sparkles, Globe, Zap 
} from 'lucide-react';

const Onboarding = () => {
  const { user, loginUser } = useAuth();
  const { refreshData } = useData();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auth state
  const [authStep, setAuthStep] = useState(!user);
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Mode Selection
  const [onboardingMode, setOnboardingMode] = useState(null); // 'chat' or 'youtube'

  // Chat state
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [phase, setPhase] = useState('discovery');
  const [draftRoadmap, setDraftRoadmap] = useState(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // YouTube state
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!user && !loading) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const startFreshSession = async () => {
      if (user) {
        setLoading(true);
        try {
          await clearChatHistory();
        } catch (e) {
          console.error("Failed to clear history:", e);
        }
        setMessages([{ 
          role: 'assistant', 
          content: "Welcome to Axiom. I am your high-accountability coach. To build your optimal learning path, tell me: Are you currently in college, preparing for entrances, or focused on job mastery?" 
        }]);
        setPhase('discovery');
        setDraftRoadmap(null);
        setLoading(false);
      }
    };
    startFreshSession();
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const observer = new MutationObserver(() => {
      scrollToBottom();
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMsg = { role: 'user', content: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const res = await onboardingChat([...messages, userMsg]);
      const fullMessage = res.message || "I'm preparing your learning path...";
      let displayedMessage = "";
      
      if (res.phase) setPhase(res.phase);
      if (res.draft_roadmap) {
        setDraftRoadmap(res.draft_roadmap);
        setGoalTitle(res.goal_title || inputText || userMsg.content);
      }

      setError('');
      setMessages(prev => [...prev, { role: 'assistant', content: "", phase: res.phase || phase }]);

      const tokens = fullMessage.split(/(\s+)/);
      for (let i = 0; i < tokens.length; i++) {
        displayedMessage += tokens[i];
        setMessages(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = { ...newHistory[newHistory.length - 1], content: displayedMessage };
          return newHistory;
        });
        if (tokens[i].trim()) {
          await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
        }
      }
    } catch (e) {
      setError("Connection interrupted. Please retry.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleYoutubeSynthesis = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await generateYoutubeRoadmap(youtubeUrl);
      setDraftRoadmap(res.draft_roadmap);
      setGoalTitle(res.goal_title);
      setPhase('ready');
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
      const title = goalTitle || draftRoadmap[0]?.title || "My Mastery Goal";
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
    setDraftRoadmap(null);
    setPhase('discovery');
    setError('');
  };

  if (!user && loading) {
    return <NeuralLoader message="INITIALIZING AUTH PROTOCOL" />;
  }

  if (!user) return null; // Should be handled by useEffect redirect

  if (!onboardingMode) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-12 flex-1 flex flex-col justify-center relative z-10">
        {/* Background Decorative Elements */}
        <div className="fixed inset-0 neural-grid opacity-20 pointer-events-none -z-10"></div>
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[160px] pointer-events-none -z-10 animate-neural-pulse"></div>

        <div className="text-center mb-16 animate-in fade-in slide-in-from-top-12 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-8 shadow-lg shadow-primary/5">
            <Sparkles className="text-primary animate-pulse" size={16} />
            <span className="text-[10px] font-label font-black text-primary uppercase tracking-[0.3em]">Session Initialized</span>
          </div>
          <h1 className="text-6xl sm:text-8xl font-black font-headline uppercase tracking-tighter text-on-surface italic mb-8 leading-none">
            SELECT YOUR <span className="text-primary drop-shadow-[0_0_30px_rgba(253,184,19,0.5)]">PATH</span>
          </h1>
          <p className="text-on-surface-variant/70 font-label text-sm sm:text-base tracking-[0.2em] uppercase max-w-3xl mx-auto leading-relaxed px-4">
            Axiom is ready to synthesize your curriculum. Choose your method of knowledge acquisition.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl mx-auto w-full px-4 sm:px-0">
          {/* Neural Chat Card */}
          <button 
            onClick={() => setOnboardingMode('chat')}
            className="group relative bg-[#0e0e10]/80 backdrop-blur-xl p-8 sm:p-12 rounded-[4rem] border border-white/5 text-left transition-all duration-500 hover:scale-[1.05] hover:border-primary/50 hover:shadow-[0_0_80px_rgba(253,184,19,0.15)] overflow-hidden animate-in slide-in-from-left-12 duration-1000"
          >
            {/* Scanner Effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/10 to-transparent h-20 w-full animate-scan opacity-0 group-hover:opacity-100 pointer-events-none z-10"></div>
            
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 group-hover:rotate-12 group-hover:scale-125">
              <MessageSquare size={200} strokeWidth={1} />
            </div>

            <div className="relative z-20">
              <div className="w-24 h-24 rounded-[2.5rem] bg-primary/10 flex items-center justify-center mb-12 border border-primary/20 group-hover:neural-glow group-hover:scale-110 transition-all duration-500 animate-float">
                <MessageSquare className="text-primary" size={40} />
              </div>
              <h3 className="text-4xl font-black font-headline uppercase tracking-tighter mb-6 group-hover:text-primary transition-colors duration-500">Learning Chat</h3>
              <p className="text-on-surface-variant/80 text-base font-light leading-relaxed mb-12 max-w-xs group-hover:text-on-surface transition-colors duration-500">
                Engage in direct dialogue with our high-accountability coach to architect a custom path.
              </p>
              <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full bg-primary/10 border border-primary/20 text-primary font-label font-black text-xs uppercase tracking-[0.2em] group-hover:bg-primary group-hover:text-black transition-all duration-500">
                Launch Chat <ArrowRight size={16} className="group-hover:translate-x-3 transition-transform duration-500" />
              </div>
            </div>
          </button>

          {/* Playlist Synthesis Card */}
          <button 
            onClick={() => setOnboardingMode('youtube')}
            className="group relative bg-[#0e0e10]/80 backdrop-blur-xl p-8 sm:p-12 rounded-[4rem] border border-white/5 text-left transition-all duration-500 hover:scale-[1.05] hover:border-secondary/50 hover:shadow-[0_0_80px_rgba(0,179,89,0.15)] overflow-hidden animate-in slide-in-from-right-12 duration-1000"
          >
            {/* Scanner Effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/10 to-transparent h-20 w-full animate-scan opacity-0 group-hover:opacity-100 pointer-events-none z-10"></div>

            <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 group-hover:-rotate-12 group-hover:scale-125">
              <Video size={200} strokeWidth={1} />
            </div>

            <div className="relative z-20">
              <div className="w-24 h-24 rounded-[2.5rem] bg-secondary/10 flex items-center justify-center mb-12 border border-secondary/20 group-hover:neural-glow-secondary group-hover:scale-110 transition-all duration-500 animate-float [animation-delay:1s]">
                <Video className="text-secondary" size={40} />
              </div>
              <h3 className="text-4xl font-black font-headline uppercase tracking-tighter mb-6 group-hover:text-secondary transition-colors duration-500">Playlist Import</h3>
              <p className="text-on-surface-variant/80 text-base font-light leading-relaxed mb-12 max-w-xs group-hover:text-on-surface transition-colors duration-500">
                Import external knowledge by transforming YouTube playlists into structured learning modules.
              </p>
              <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full bg-secondary/10 border border-secondary/20 text-secondary font-label font-black text-xs uppercase tracking-[0.2em] group-hover:bg-secondary group-hover:text-black transition-all duration-500">
                Paste URL <ArrowRight size={16} className="group-hover:translate-x-3 transition-transform duration-500" />
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 min-h-[500px] flex flex-col animate-in fade-in duration-1000">
      {loading && <NeuralLoader message="GENERATING LEARNING PATH" />}

      <div className="flex-1 flex flex-col bg-surface-container-low/30 rounded-2xl sm:rounded-[2.5rem] border border-outline-variant/10 overflow-hidden relative backdrop-blur-sm">
        <div className="w-full p-3 sm:p-6 flex justify-between items-center border-b border-outline-variant/10 bg-surface-container-low/50 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button 
               onClick={() => setOnboardingMode(null)}
               className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/10 hover:border-primary/40 transition-all group"
            >
              <History className="text-on-surface-variant group-hover:text-primary" size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`h-2 w-2 rounded-full animate-pulse ${onboardingMode === 'chat' ? 'bg-primary' : 'bg-secondary'}`}></span>
                <span className={`font-label text-[10px] tracking-[0.3em] uppercase font-bold ${onboardingMode === 'chat' ? 'text-primary' : 'text-secondary'}`}>
                  {onboardingMode === 'chat' ? 'Axiom Link Active' : 'Import Engine Active'}
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-black font-headline uppercase tracking-tighter text-on-surface">
                {onboardingMode === 'chat' ? 'Axiom Assistant' : 'Playlist Architect'}
              </h2>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-label uppercase text-on-surface-variant/40 tracking-widest mb-1">Process Phase</span>
            <div className="px-3 py-1 bg-surface-container-highest rounded-full border border-outline-variant/20 shadow-inner">
               <span className="text-[10px] font-label font-black text-primary uppercase tracking-[0.2em]">{phase}</span>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-4 sm:px-8 sm:py-8 space-y-4 custom-scrollbar"
        >
          {onboardingMode === 'chat' && messages.map((m, i) => (
            <MessageBubble key={i} message={m.content} role={m.role} phase={m.role === 'assistant' ? (m.phase || phase) : null} />
          ))}

          {onboardingMode === 'youtube' && !draftRoadmap && (
             <div className="h-full flex flex-col items-center justify-center text-center p-10 max-w-2xl mx-auto">
                <div className="w-24 h-24 rounded-[2rem] bg-secondary/10 flex items-center justify-center mb-8 border border-secondary/20 shadow-[0_0_40px_rgba(0,179,89,0.2)]">
                  <Video className="text-secondary" size={40} />
                </div>
                <h3 className="text-4xl font-black font-headline uppercase tracking-tighter mb-4 italic">Playlist Import</h3>
                <p className="text-on-surface-variant/70 text-sm font-light leading-relaxed mb-10">
                   Provide a public YouTube playlist URL. Our engine will analyze the content and generate a master roadmap.
                </p>
                <form onSubmit={handleYoutubeSynthesis} className="w-full relative group">
                  <Globe className="absolute left-6 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-secondary transition-colors" size={20} />
                  <input 
                    type="url" 
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/playlist?list=..."
                    className="w-full bg-surface-container-lowest/80 border border-outline-variant/20 rounded-[2rem] pl-16 pr-24 py-6 text-on-surface text-sm font-light focus:ring-4 focus:ring-secondary/20 focus:border-secondary/40 outline-none transition-all shadow-2xl"
                    required
                  />
                  <button 
                    type="submit"
                    disabled={!youtubeUrl || loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-3 bg-secondary text-on-primary-container rounded-full font-label font-bold text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-20"
                  >
                    Generate
                  </button>
                </form>
             </div>
          )}

          {isTyping && onboardingMode === 'chat' && (
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

          {draftRoadmap && (
            <div className="w-full mt-12 animate-in zoom-in duration-700">
              <div className="bg-gradient-to-br from-[#0e0e10] to-[#1c1b1d] border border-primary/30 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-10 shadow-2xl relative overflow-hidden">
                <header className="mb-10 relative z-10">
                  <span className="font-label text-[10px] tracking-[0.3em] text-primary uppercase font-bold bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                    {onboardingMode === 'youtube' ? 'Extracted Learning Path' : 'Proposed Learning Path'}
                  </span>
                  <h3 className="text-4xl font-black font-headline uppercase mt-4 tracking-tighter italic">
                    {onboardingMode === 'youtube' ? 'Draft Generated' : 'Learning Draft'}
                  </h3>
                  {goalTitle && <p className="text-on-surface-variant/60 font-label text-[10px] uppercase tracking-[0.2em] mt-2">{goalTitle}</p>}
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

                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 relative z-10 pt-6 border-t border-outline-variant/10">
                  <button onClick={handleFinalize} className="group relative px-10 py-5 bg-primary text-on-primary-container rounded-full overflow-hidden transition-all duration-300 active:scale-95 shadow-2xl shadow-primary/40 w-full sm:w-auto">
                    <span className="relative z-10 font-label font-bold tracking-[0.4em] uppercase text-xs">Activate Learning Path</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-secondary to-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </button>
                  <button onClick={handleRefine} className="px-10 py-5 bg-surface-container-highest/50 text-on-surface-variant hover:text-primary border border-outline-variant/20 rounded-full font-label font-bold tracking-[0.3em] uppercase text-[10px] transition-all hover:bg-primary/5 hover:border-primary/30 w-full sm:w-auto">
                    New Draft
                  </button>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {onboardingMode === 'chat' && (
          <div className="p-3 sm:p-8 border-t border-outline-variant/10 bg-surface-container-low/50">
            <form onSubmit={handleSendMessage} className="relative group max-w-4xl mx-auto">
              <div className="relative flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isTyping}
                  placeholder="Respond to Axiom..."
                  className="w-full bg-surface-container-lowest/80 border border-outline-variant/20 rounded-xl sm:rounded-2xl px-4 py-3.5 sm:px-8 sm:py-5 pr-14 sm:pr-20 text-on-surface text-sm font-light focus:ring-2 focus:ring-primary/40 outline-none transition-all shadow-2xl"
                />
                <button type="submit" disabled={!inputText.trim() || isTyping} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-primary text-on-primary-container rounded-lg sm:rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-lg shadow-primary/20">
                  {isTyping ? <Activity size={20} className="animate-pulse" /> : <Send size={20} />}
                </button>
              </div>
            </form>
          </div>
        )}
        {error && <p className="text-error text-[10px] font-label font-bold uppercase tracking-widest text-center mt-4 animate-bounce mb-8">{error}</p>}
      </div>
    </div>
  );
};

export default Onboarding;
