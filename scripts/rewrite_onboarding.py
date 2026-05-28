import re

def rewrite():
    path = "/home/ansh/projects/Axiom/frontend/src/pages/Onboarding.jsx"
    with open(path, "r") as f:
        content = f.read()

    # 1. Update imports
    content = content.replace(
        "onboardingChat, finalizeGoal",
        "onboardingChat, finalizeGoal, getChatSessions, getSessionMessages, deleteChatSession"
    )
    content = content.replace(
        "import { \n  Send, Activity, ChevronRight, History, \n  BrainCircuit, Search, Video, MessageSquare, \n  ArrowRight, Sparkles, Globe, Zap,\n  Plus, Mic, Edit3, Compass\n} from 'lucide-react';",
        "import { \n  Send, Activity, ChevronRight, History, \n  BrainCircuit, Search, Video, MessageSquare, \n  ArrowRight, Sparkles, Globe, Zap,\n  Plus, Mic, Edit3, Compass, MessageCircle, Trash2\n} from 'lucide-react';"
    )

    # 2. Add State
    state_addition = """
  // Chat state
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
"""
    content = content.replace("  // Chat state", state_addition)

    # 3. Replace useEffect for fresh session
    old_use_effect = """  useEffect(() => {
    const startFreshSession = async () => {
      if (user) {
        setLoading(true);
        try {
          await clearChatHistory();
        } catch (e) {
          console.error("Failed to clear history:", e);
        }
        setMessages([]);
        setPhase('discovery');
        setDraftRoadmap(null);
        setLoading(false);
      }
    };
    startFreshSession();
  }, [user]);"""
    
    new_use_effect = """  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
  }, [user]);

  const loadChatSessions = async () => {
    try {
      const res = await getChatSessions();
      setChatSessions(res.sessions || []);
    } catch (e) {
      console.error(e);
    }
  };

  const startFreshSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setPhase('discovery');
    setDraftRoadmap(null);
  };

  const loadSession = async (sessionId) => {
    setLoading(true);
    try {
      const res = await getSessionMessages(sessionId);
      setMessages(res.messages || []);
      setCurrentSessionId(sessionId);
      setPhase('discovery');
      setDraftRoadmap(null);
      setOnboardingMode('chat');
    } catch(e) {
       setError("Failed to load session");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await deleteChatSession(sessionId);
      setChatSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        startFreshSession();
      }
    } catch (err) {
      console.error(err);
    }
  };"""
    content = content.replace(old_use_effect, new_use_effect)

    # 4. Update handleSendMessage
    content = content.replace(
        "const res = await onboardingChat([...messages, userMsg]);",
        """const res = await onboardingChat([...messages, userMsg], currentSessionId);
      if (res.session_id && !currentSessionId) {
         setCurrentSessionId(res.session_id);
         loadChatSessions();
      }"""
    )

    # 5. Restructure Layout
    # Find the start of the return statement for the active modes
    layout_start_idx = content.find("return (\n    <div className=\"w-full flex-1 min-h-[500px] flex flex-col animate-in fade-in duration-1000\">")
    
    # We will replace the entire return block to inject the split layout properly.
    # It's safer to just provide the replacement content for everything from return onwards.
    
    new_return = """return (
    <div className="w-full flex-1 min-h-[500px] flex animate-in fade-in duration-1000">
      {loading && <NeuralLoader message="PROCESSING..." />}

      <div className={`flex w-full bg-surface-container-low/30 rounded-2xl sm:rounded-[2.5rem] border border-outline-variant/10 overflow-hidden relative backdrop-blur-sm ${onboardingMode === 'chat' ? 'flex-row' : 'flex-col'}`}>
        
        {/* Left Sidebar for Chat Mode */}
        {onboardingMode === 'chat' && (
          <div className="hidden md:flex w-64 bg-[#0e0e10] border-r border-outline-variant/10 flex-col p-4 z-30">
             <button 
                onClick={startFreshSession}
                className="flex items-center gap-3 w-full p-3 rounded-xl bg-surface-container-highest hover:bg-surface-container-highest/80 text-on-surface font-label text-sm transition-all mb-8 border border-outline-variant/20 group"
             >
                <Plus size={18} className="text-on-surface-variant group-hover:text-primary transition-colors" />
                New Chat
             </button>
             
             <div className="text-xs font-label uppercase text-on-surface-variant/50 tracking-widest mb-4 px-2">Recents</div>
             
             <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                {chatSessions.map((s) => (
                  <div 
                    key={s.id} 
                    onClick={() => loadSession(s.id)}
                    className={`group flex items-center justify-between w-full p-3 rounded-xl cursor-pointer transition-all ${currentSessionId === s.id ? 'bg-surface-container-highest text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-highest/50'}`}
                  >
                     <div className="flex items-center gap-3 overflow-hidden">
                        <MessageCircle size={16} className="shrink-0" />
                        <span className="truncate text-sm font-light">{s.title || 'New Chat'}</span>
                     </div>
                     <button 
                        onClick={(e) => handleDeleteSession(e, s.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant hover:text-error transition-all"
                     >
                        <Trash2 size={14} />
                     </button>
                  </div>
                ))}
             </div>
          </div>
        )}

        <div className="flex-1 flex flex-col relative">
          <div className="w-full p-3 sm:p-6 flex justify-between items-center border-b border-outline-variant/10 bg-surface-container-low/50 backdrop-blur-xl sticky top-0 z-20">
            <div className="flex items-center gap-4">
              <button 
                 onClick={() => setOnboardingMode(null)}
                 className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/10 hover:border-primary/40 transition-all group"
              >
                <ChevronRight className="rotate-180 text-on-surface-variant group-hover:text-primary" size={20} />
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
            {onboardingMode === 'chat' && messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center pb-20 animate-in fade-in zoom-in duration-700">
                 <h2 className="text-2xl sm:text-3xl text-on-surface mb-8 font-light tracking-wide">What's on the agenda today?</h2>
                 <form onSubmit={handleSendMessage} className="w-full max-w-2xl relative group mb-6">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">
                      <Plus size={24} />
                    </div>
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      disabled={isTyping}
                      placeholder="Ask anything"
                      className="w-full bg-surface-container-highest/80 border border-outline-variant/10 rounded-[2rem] pl-14 py-4 pr-16 text-on-surface text-base focus:border-outline-variant/30 focus:bg-surface-container-highest outline-none shadow-2xl transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button type="button" className="p-2 text-on-surface-variant hover:text-white transition-colors">
                        <Mic size={20} />
                      </button>
                      <button type="submit" disabled={!inputText.trim() || isTyping} className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:brightness-110 disabled:opacity-20 disabled:bg-surface-container-highest disabled:text-on-surface-variant transition-all">
                        <Send size={14} />
                      </button>
                    </div>
                 </form>
                 <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
                    <button onClick={() => setInputText("Generate a study plan for Quantum Physics")} className="px-4 py-2.5 rounded-full border border-outline-variant/10 text-on-surface-variant text-sm hover:bg-surface-container-highest transition-colors flex items-center gap-2">
                      <Sparkles size={16} /> Create a curriculum
                    </button>
                    <button onClick={() => setInputText("I need to practice React.js hooks")} className="px-4 py-2.5 rounded-full border border-outline-variant/10 text-on-surface-variant text-sm hover:bg-surface-container-highest transition-colors flex items-center gap-2">
                      <Edit3 size={16} /> Write or practice
                    </button>
                    <button onClick={() => setInputText("Explain the theory of relativity")} className="px-4 py-2.5 rounded-full border border-outline-variant/10 text-on-surface-variant text-sm hover:bg-surface-container-highest transition-colors flex items-center gap-2">
                      <Compass size={16} /> Look something up
                    </button>
                 </div>
              </div>
            )}

            {onboardingMode === 'chat' && messages.length > 0 && messages.map((m, i) => (
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

          {onboardingMode === 'chat' && messages.length > 0 && (
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
    </div>
  );
};

export default Onboarding;
"""

    content = content[:layout_start_idx] + new_return
    
    with open(path, "w") as f:
        f.write(content)
    
    print("Rewritten successfully.")

if __name__ == "__main__":
    rewrite()
