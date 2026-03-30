import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register, login, onboardingChat, finalizeGoal } from '../services/api';
import NeuralLoader from '../components/NeuralLoader';

const Onboarding = () => {
  const { user, loginUser } = useAuth();
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
      // Initialize chat if logged in and no messages
      const welcomeMsg = {
        role: 'assistant',
        content: "Welcome to Axiom. I am your high-accountability coach. To build your optimal neural path, tell me: Are you currently in college, preparing for entrances, or focused on job mastery?"
      };
      setMessages([welcomeMsg]);
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
      // setAuthStep will be handled by useEffect [user]
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
      if (res.draft_roadmap) {
        setDraftRoadmap(res.draft_roadmap);
      }
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
      // Find a suitable title from the conversation or the roadmap
      const title = draftRoadmap[0]?.title || "My Mastery Goal";
      await finalizeGoal(title, draftRoadmap);
      navigate('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Auth UI ---
  if (authStep) {
    return (
      <div className="w-full max-w-md mx-auto mt-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary/20">
            <span className="material-symbols-outlined text-primary text-3xl">neurology</span>
          </div>
          <h2 className="text-3xl font-black font-headline uppercase tracking-tighter text-on-surface">Initialize Session</h2>
          <p className="text-on-surface-variant font-label text-[10px] tracking-widest uppercase mt-2 opacity-60 italic">Neural Protocol // V.1.0.4</p>
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
              placeholder="user@neural.network"
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
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-4 bg-error-container/10 border border-error/20 rounded-xl">
              <p className="text-error text-xs font-bold text-center font-label">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-gradient-to-br from-primary to-primary-container text-on-primary-container font-label font-bold text-xs tracking-[0.3em] uppercase rounded-2xl active:scale-95 transition-all shadow-xl shadow-primary/20"
          >
            {loading ? 'Processing...' : mode === 'register' ? 'Verify & Register' : 'Authorize Login'}
          </button>

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
              className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest hover:text-primary transition-colors"
            >
              {mode === 'register' ? 'Switch to Login' : 'Switch to Register'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // --- Chat UI ---
  return (
    <div className="w-full max-w-5xl mx-auto h-[85vh] flex flex-col items-center">
      {loading && <NeuralLoader message="Activating Goal" />}
      
      {/* Chat Header */}
      <div className="w-full mb-8 flex justify-between items-end border-b border-outline-variant/10 pb-6 px-4">
        <div>
          <span className="font-label text-[10px] tracking-[0.3em] text-secondary uppercase font-bold">Bridge Connected</span>
          <h2 className="text-3xl font-black font-headline uppercase tracking-tighter">Axiom AI Coach</h2>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-label uppercase opacity-40">System Phase</span>
            <span className="text-[10px] font-label font-bold text-primary uppercase tracking-widest">{phase}</span>
          </div>
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 w-full overflow-y-auto px-4 space-y-6 pb-6 custom-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
            <div className={`max-w-[80%] p-6 rounded-[1.5rem] shadow-sm ${
              m.role === 'user'
                ? 'bg-primary-container/20 text-on-surface border border-primary/20 rounded-tr-none'
                : 'bg-surface-container-low border border-outline-variant/10 shadow-lg rounded-tl-none'
            }`}>
              <p className="text-sm leading-relaxed font-light whitespace-pre-wrap">{m.content}</p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-surface-container-low border border-outline-variant/10 p-4 rounded-2xl rounded-tl-none">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}

        {/* Draft Roadmap Display */}
        {draftRoadmap && (
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
                       {task.title}
                     </h4>
                     <ul className="space-y-2">
                       {task.parts?.slice(0, 3).map((p, pidx) => (
                         <li key={pidx} className="flex items-center gap-3 text-xs text-on-surface-variant font-light">
                           <span className="w-1 h-1 bg-primary/40 rounded-full"></span>
                           {p}
                         </li>
                       ))}
                       {task.parts?.length > 3 && <li className="text-[10px] italic opacity-30 ml-4">+ {task.parts.length - 3} more modules</li>}
                     </ul>
                   </div>
                 ))}
               </div>

               {phase === 'ready' && (
                 <div className="flex justify-center relative z-10 pt-4 border-t border-outline-variant/10">
                   <button
                    onClick={handleFinalize}
                    className="group relative px-12 py-5 bg-primary text-on-primary-container rounded-full overflow-hidden transition-all duration-300 active:scale-95 shadow-2xl shadow-primary/40"
                   >
                     <span className="relative z-10 font-label font-bold tracking-[0.4em] uppercase text-xs">Activate Neural Path</span>
                     <div className="absolute inset-0 bg-gradient-to-r from-secondary to-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   </button>
                 </div>
               )}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat Input */}
      <div className="w-full max-w-4xl mt-6 px-4 pb-8">
        <form onSubmit={handleSendMessage} className="relative group">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isTyping || phase === 'ready'}
            placeholder={phase === 'ready' ? "Roadmap finalized. Press Activate to begin." : "Respond to Axiom..."}
            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-[2rem] px-8 py-5 pr-16 text-on-surface font-light focus:ring-2 focus:ring-primary/40 focus:border-transparent outline-none transition-all shadow-xl disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping || phase === 'ready'}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-primary text-on-primary-container rounded-full flex items-center justify-center active:scale-90 transition-all disabled:opacity-20"
          >
            <span className="material-symbols-outlined text-xl">arrow_forward</span>
          </button>
          
          {/* Quick Suggestions */}
          {phase === 'discovery' && messages.length <= 2 && (
            <div className="flex flex-wrap gap-2 mt-4 px-2">
              {['College Student', 'Preparing for Exam', 'Career Mastery'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInputText(s)}
                  className="px-4 py-1.5 rounded-full border border-outline-variant/10 bg-surface-container-low text-[10px] font-label font-bold text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all uppercase tracking-widest"
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
  );
};

export default Onboarding;
