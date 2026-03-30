import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { register, login, onboardingChat, finalizeGoal, activateGoal } from '../services/api';
import NeuralLoader from '../components/NeuralLoader';

const Onboarding = () => {
  const { user, loginUser, logout } = useAuth();
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
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (user && messages.length === 0) {
      setMessages([{ role: 'assistant', content: "Welcome to Axiom. I am your high-accountability coach. To build your optimal neural path, tell me: Are you currently in college, preparing for entrances, or focused on job mastery?" }]);
      setAuthStep(false);
    }
  }, [user, messages.length]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const fn = mode === 'register' ? register : login;
      const res = await fn(email, password);
      await loginUser(res.access_token);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const userMsg = { role: 'user', content: inputText };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setIsTyping(true);

    try {
      const res = await onboardingChat(newMessages);
      setMessages([...newMessages, { role: 'assistant', content: res.message }]);
      setPhase(res.phase);
      if (res.draft_roadmap) setDraftRoadmap(res.draft_roadmap);
    } catch (e) {
      setError("Neural link interrupted. Please retry.");
    } finally {
      setIsTyping(false);
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
    <div className="grid grid-cols-12 gap-8 w-full h-[calc(100vh-12rem)]">
      {loading && <NeuralLoader message="Calibrating Neural Path" />}
      
      {/* Neural History Panel */}
      <aside className="col-span-3 flex flex-col gap-6">
        <header className="mb-2">
          <span className="text-[10px] font-label font-bold text-primary uppercase tracking-widest block mb-2">Memory Bank</span>
          <h3 className="text-2xl font-black font-headline uppercase tracking-tighter text-on-surface">Neural History</h3>
        </header>
        
        <div className="flex-1 overflow-y-auto pr-4 space-y-4 custom-scrollbar">
          {goals.length === 0 ? (
            <div className="p-8 border border-dashed border-outline-variant/20 rounded-2xl text-center">
              <p className="text-xs text-on-surface-variant font-label uppercase tracking-widest leading-loose">No neural records found. Begin discovery to create your first path.</p>
            </div>
          ) : (
            goals.map(g => (
              <button
                key={g.id}
                onClick={() => handleSwitchGoal(g.id)}
                className={`w-full text-left p-5 rounded-2xl border transition-all active:scale-95 group ${
                  g.status === 'active' ? 'bg-primary/5 border-primary/30 shadow-lg shadow-primary/5' : 'bg-surface-container-low border-outline-variant/10 hover:border-outline-variant/30 hover:bg-surface-container-highest/20'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[8px] font-label uppercase tracking-widest px-2 py-0.5 rounded border ${
                    g.status === 'active' ? 'border-primary/40 text-primary animate-pulse' : 'border-outline-variant/20 text-on-surface-variant'
                  }`}>{g.status}</span>
                </div>
                <h4 className={`text-sm font-bold line-clamp-2 transition-colors ${g.status === 'active' ? 'text-on-surface' : 'text-on-surface-variant/80 group-hover:text-primary'}`}>{g.title}</h4>
                {g.status !== 'active' && (
                  <div className="mt-4 flex items-center gap-2 text-[8px] font-label font-bold uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all text-primary">
                    Open Path <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* AI Coach Area */}
      <main className="col-span-9 flex flex-col bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 shadow-2xl relative overflow-hidden">
        <header className="p-8 border-b border-outline-variant/5 flex justify-between items-center bg-surface-container-low/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
               <span className="material-symbols-outlined text-primary text-2xl">neurology</span>
             </div>
             <div>
               <h2 className="text-xl font-black font-headline uppercase tracking-tighter text-on-surface">Axiom AI Coach</h2>
               <p className="text-[10px] font-label font-bold text-primary uppercase tracking-[0.3em]">Neural Interface // Active</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <span className="w-2 h-2 bg-primary rounded-full animate-ping"></span>
             <span className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest">{phase} phase</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className={`max-w-[80%] p-6 rounded-[2rem] ${
                m.role === 'user'
                  ? 'bg-primary text-on-primary-container shadow-xl rounded-tr-none font-bold'
                  : 'bg-surface-container-highest text-on-surface rounded-tl-none border border-outline-variant/10'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}

          {isTyping && (
             <div className="flex justify-start">
               <div className="bg-surface-container-highest px-6 py-4 rounded-[2rem] border border-outline-variant/10">
                 <div className="flex gap-2">
                   <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></div>
                   <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                   <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                 </div>
               </div>
             </div>
          )}

          {draftRoadmap && (
             <div className="w-full mt-12 animate-in zoom-in duration-700">
                <div className="bg-primary/5 border border-primary/20 rounded-[2.5rem] p-10 backdrop-blur-xl">
                  <header className="mb-10 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-primary block mb-2">Neural Synthesis Result</span>
                    <h3 className="text-3xl font-black font-headline uppercase italic tracking-tighter text-on-surface">Proposed Roadmap</h3>
                  </header>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    {draftRoadmap.map((task, tidx) => (
                      <div key={tidx} className="p-6 bg-surface-container-low border border-outline-variant/10 rounded-2xl shadow-lg">
                        <h4 className="text-xs font-bold text-primary uppercase mb-3 tracking-widest">Phase 0{tidx+1} // {task.title}</h4>
                        <div className="space-y-2">
                           {task.parts?.slice(0, 3).map((p, pidx) => (
                             <div key={pidx} className="text-[10px] text-on-surface-variant flex items-center gap-3">
                               <span className="w-1 h-1 bg-primary/40 rounded-full"></span> {p}
                             </div>
                           ))}
                           {task.parts?.length > 3 && (
                             <div className="text-[8px] text-primary font-bold uppercase tracking-widest pt-2">+{task.parts.length - 3} more modules...</div>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {phase === 'ready' && (
                    <div className="flex justify-center pt-8 border-t border-outline-variant/10">
                       <button onClick={handleFinalize} className="px-12 py-5 bg-primary text-on-primary-container rounded-2xl font-label font-bold tracking-widest uppercase text-xs hover:scale-105 transition-all shadow-xl shadow-primary/20 group">
                         Activate Neural Path
                         <span className="material-symbols-outlined ml-2 text-lg group-hover:translate-x-1 transition-transform">bolt</span>
                       </button>
                    </div>
                  )}
                </div>
             </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-8 bg-surface-container-low/80 backdrop-blur-xl border-t border-outline-variant/5 sticky bottom-0">
          <form onSubmit={handleSendMessage} className="relative group shadow-2xl">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isTyping || phase === 'ready'}
              placeholder={phase === 'ready' ? "Neural path synthesized." : "Communicate with Axiom AI..."}
              className="w-full bg-surface-container-highest border border-outline-variant/10 rounded-[2rem] px-8 py-5 pr-16 text-on-surface font-light focus:ring-2 focus:ring-primary/40 outline-none transition-all placeholder:opacity-30"
            />
            <button disabled={!inputText.trim() || isTyping || phase === 'ready'} className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-primary text-on-primary-container rounded-full flex items-center justify-center hover:scale-105 transition-all disabled:opacity-20 shadow-lg">
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Onboarding;
