import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  onboardingChat, finalizeGoal, getChatSessions, getSessionMessages, deleteChatSession, 
  clearChatHistory, generateYoutubeRoadmap 
} from '../services/api';
import { useData } from '../context/DataContext';
import NeuralLoader from '../components/NeuralLoader';
import MessageBubble from '../components/MessageBubble';
import GoalSelectionGrid from '../components/GoalSelectionGrid';
import InteractiveDiscoveryCard from '../components/InteractiveDiscoveryCard';
import { 
  Send, Activity, ChevronRight, History, 
  BrainCircuit, Search, Video, MessageSquare, 
  ArrowRight, Sparkles, Globe, Zap,
  Plus, Edit3, Compass, MessageCircle, Trash2,
  HelpCircle, CheckCircle2, Paperclip, X, FileText
} from 'lucide-react';

const Onboarding = () => {
  const { user, loginUser } = useAuth();
  const { refreshData, setSelectedGoalId } = useData();
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
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [phase, setPhase] = useState('chat');
  const [draftRoadmap, setDraftRoadmap] = useState(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [extractedProfile, setExtractedProfile] = useState({});
  const [isTyping, setIsTyping] = useState(false);

  // Configuration state
  const [studyDays, setStudyDays] = useState([1, 2, 3, 4, 5]); // 0=Sun, 1=Mon...
  const [studySessions, setStudySessions] = useState(['18:00']);
  const [includeQuizzes, setIncludeQuizzes] = useState(false);
  const [quizLevel, setQuizLevel] = useState('medium');
  const [quizQuestions, setQuizQuestions] = useState(10);

  // YouTube state
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setSelectedFile({
        name: file.name,
        type: 'image',
        content: `[Attached Image: ${file.name}]`
      });
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result || '';
        setSelectedFile({
          name: file.name,
          type: 'text',
          content: `[Attached File: ${file.name}]\n--- File Content ---\n${text.slice(0, 6000)}\n--- End File Content ---`
        });
      };
      reader.readAsText(file);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!user && !loading) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
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
    setPhase('chat');
    setDraftRoadmap(null);
  };

  const loadSession = async (sessionId) => {
    setLoading(true);
    try {
      const res = await getSessionMessages(sessionId);
      setMessages(res.messages || []);
      setCurrentSessionId(sessionId);
      setPhase('chat');
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
  };

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

    const userInput = inputText.trim();
    const isYoutubeLink = userInput.includes('youtube.com/') || userInput.includes('youtu.be/');

    const userMsg = { role: 'user', content: userInput };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    if (isYoutubeLink) {
      try {
        const res = await generateYoutubeRoadmap(userInput);
        setDraftRoadmap(res.draft_roadmap);
        setGoalTitle(res.goal_title);
        setPhase('ready');
        setMessages(prev => [...prev, { role: 'assistant', content: "I have successfully analyzed the YouTube content and generated a structured learning path. Review your curriculum and finalize the goal.", phase: 'ready' }]);
      } catch (err) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Failed to synthesize YouTube content: ${err.message}`, phase: phase }]);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    try {
      const res = await onboardingChat([...messages, userMsg], currentSessionId);
      if (res.session_id && !currentSessionId) {
         setCurrentSessionId(res.session_id);
         loadChatSessions();
      }
      const fullMessage = res.message || "I'm preparing your learning path...";
      let displayedMessage = "";
      
      if (res.phase) setPhase(res.phase);
      if (res.study_profile_update && Object.keys(res.study_profile_update).length > 0) {
        setExtractedProfile(prev => ({ ...prev, ...res.study_profile_update }));
      }
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

  const handleDiscoverySubmit = async (prefs) => {
    setExtractedProfile(prev => ({
      ...prev,
      months_remaining: prefs.months,
      study_hours_per_day: prefs.dailyHours,
      preferred_language: prefs.language,
      preferred_youtubers: prefs.playlistUrl || 'Web Search / Top Playlists'
    }));

    const userMsg = { role: 'user', content: prefs.summaryText };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await onboardingChat([...messages, userMsg], currentSessionId);
      if (res.session_id && !currentSessionId) {
        setCurrentSessionId(res.session_id);
        loadChatSessions();
      }
      if (res.phase) setPhase(res.phase);
      if (res.study_profile_update) {
        setExtractedProfile(prev => ({ ...prev, ...res.study_profile_update }));
      }
      if (res.draft_roadmap) {
        setDraftRoadmap(res.draft_roadmap);
        setGoalTitle(res.goal_title || extractedProfile.target_exam || "Master Learning Path");
      }
      setMessages(prev => [...prev, { role: 'assistant', content: res.message || "I have synthesized your master roadmap based on your choices!", phase: res.phase || phase }]);
    } catch (err) {
      console.error(err);
      setError("Failed to synthesize roadmap.");
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

  const handlePredefinedGoal = async (title) => {
    if (title === "CUSTOM") {
      setOnboardingMode('chat');
      return;
    }
    
    setOnboardingMode('chat');
    startFreshSession();
    
    const userMsg = { role: 'user', content: `Generate a comprehensive study plan and curriculum for: ${title}` };
    setMessages([userMsg]);
    setIsTyping(true);
    setPhase('discovery');
    
    try {
      const res = await onboardingChat([userMsg], null);
      if (res.session_id) {
         setCurrentSessionId(res.session_id);
         loadChatSessions();
      }
      const fullMessage = res.message || "I'm preparing your learning path...";
      let displayedMessage = "";
      
      if (res.phase) setPhase(res.phase);
      if (res.draft_roadmap) {
        setDraftRoadmap(res.draft_roadmap);
        setGoalTitle(res.goal_title || title);
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

  const handleFinalize = async () => {
    if (!draftRoadmap) return;
    setLoading(true);
    try {
      const title = goalTitle || draftRoadmap[0]?.title || "My Mastery Goal";
      const settings = {
        study_days: studyDays,
        study_sessions: studySessions,
        quiz_level: quizLevel,
        quiz_questions: includeQuizzes ? quizQuestions : 0,
        include_quizzes: includeQuizzes,
        target_months: extractedProfile.months_remaining,
        daily_hours: extractedProfile.study_hours_per_day,
      };
      const newGoal = await finalizeGoal(title, draftRoadmap, settings, extractedProfile);
      if (newGoal && newGoal.id) {
        setSelectedGoalId(newGoal.id);
      }
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

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
          <h1 className="text-6xl sm:text-8xl font-black font-headline uppercase tracking-tighter text-on-surface italic mb-8 leading-none">
            SELECT YOUR <span className="text-primary drop-shadow-[0_0_30px_rgba(253,184,19,0.5)]">PATH</span>
          </h1>
          <p className="text-on-surface-variant/70 font-label text-sm sm:text-base tracking-[0.2em] uppercase max-w-3xl mx-auto leading-relaxed px-4">
            Choose how you want to build your learning path.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto w-full px-4 sm:px-0">
          {/* AI Architect Card */}
          <button 
            onClick={() => setOnboardingMode('chat')}
            className="group relative bg-black/80 backdrop-blur-xl p-8 sm:p-12 rounded-[4rem] border border-white/5 text-left transition-all duration-500 hover:scale-[1.05] hover:border-primary/50 hover:shadow-[0_0_80px_rgba(253,184,19,0.15)] overflow-hidden animate-in slide-in-from-left-12 duration-1000"
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
              <h3 className="text-4xl font-black font-headline uppercase tracking-tighter mb-6 group-hover:text-primary transition-colors duration-500">AI Architect</h3>
              <p className="text-on-surface-variant/80 text-base font-light leading-relaxed mb-12 max-w-xs group-hover:text-on-surface transition-colors duration-500">
                Engage in direct dialogue with our high-accountability coach to architect a custom path.
              </p>
              <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full bg-primary/10 border border-primary/20 text-primary font-label font-black text-xs uppercase tracking-[0.2em] group-hover:bg-primary group-hover:text-black transition-all duration-500">
                Launch Chat <ArrowRight size={16} className="group-hover:translate-x-3 transition-transform duration-500" />
              </div>
            </div>
          </button>

          {/* YouTube Playlist Card */}
          <button 
            onClick={() => setOnboardingMode('youtube')}
            className="group relative bg-black/80 backdrop-blur-xl p-8 sm:p-12 rounded-[4rem] border border-white/5 text-left transition-all duration-500 hover:scale-[1.05] hover:border-emerald-500/50 hover:shadow-[0_0_80px_rgba(16,185,129,0.15)] overflow-hidden animate-in slide-in-from-right-12 duration-1000"
          >
            {/* Scanner Effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent h-20 w-full animate-scan opacity-0 group-hover:opacity-100 pointer-events-none z-10"></div>
            
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 group-hover:-rotate-12 group-hover:scale-125">
              <Video size={200} strokeWidth={1} />
            </div>

            <div className="relative z-20">
              <div className="w-24 h-24 rounded-[2.5rem] bg-emerald-500/10 flex items-center justify-center mb-12 border border-emerald-500/20 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] group-hover:scale-110 transition-all duration-500 animate-float [animation-delay:0.5s]">
                <Video className="text-emerald-400" size={40} />
              </div>
              <h3 className="text-4xl font-black font-headline uppercase tracking-tighter mb-6 group-hover:text-emerald-400 transition-colors duration-500">YouTube Playlist</h3>
              <p className="text-on-surface-variant/80 text-base font-light leading-relaxed mb-12 max-w-xs group-hover:text-on-surface transition-colors duration-500">
                Provide a YouTube playlist URL to extract video modules and generate a custom roadmap.
              </p>
              <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-label font-black text-xs uppercase tracking-[0.2em] group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
                Import Playlist <ArrowRight size={16} className="group-hover:translate-x-3 transition-transform duration-500" />
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
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

                <h2 className="text-base sm:text-xl font-black font-headline uppercase tracking-tighter text-on-surface">
                  {onboardingMode === 'chat' ? 'Edxiom Assistant' : onboardingMode === 'youtube' ? 'Playlist Architect' : 'Path Selector'}
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
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".txt,.md,.json,.csv,.pdf,.png,.jpg,.jpeg,.js,.py,.html,.css"
                    />
                    {selectedFile && (
                      <div className="mb-3 flex items-center justify-between bg-surface-container-highest border border-outline-variant/20 px-4 py-2 rounded-xl text-xs text-on-surface">
                        <div className="flex items-center gap-2 truncate">
                          <FileText size={16} className="text-primary shrink-0" />
                          <span className="truncate">{selectedFile.name}</span>
                        </div>
                        <button type="button" onClick={() => setSelectedFile(null)} className="text-on-surface-variant hover:text-white p-1">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    <div className="relative flex items-center">
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        title="Upload File"
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors p-1"
                      >
                        <Paperclip size={20} />
                      </button>
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        disabled={isTyping}
                        placeholder="Ask anything or upload a syllabus/doc..."
                        className="w-full bg-surface-container-highest/80 border border-outline-variant/10 rounded-[2rem] pl-14 py-4 pr-16 text-on-surface text-base focus:border-outline-variant/30 focus:bg-surface-container-highest outline-none shadow-2xl transition-all"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button type="submit" disabled={(!inputText.trim() && !selectedFile) || isTyping} className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:brightness-110 disabled:opacity-20 disabled:bg-surface-container-highest disabled:text-on-surface-variant transition-all">
                          <Send size={14} />
                        </button>
                      </div>
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



            {onboardingMode === 'chat' && messages.length > 0 && messages.map((m, i) => {
              const lastAssistantIdx = messages.findLastIndex(msg => msg.role === 'assistant');
              const isLastAssistant = i === lastAssistantIdx;
              return (
                <MessageBubble 
                  key={i} 
                  message={m.content} 
                  role={m.role} 
                  phase={m.role === 'assistant' ? (m.phase || phase) : null} 
                  onDiscoverySubmit={!draftRoadmap ? handleDiscoverySubmit : null}
                  targetExam={extractedProfile.target_exam}
                  isLastAssistantMessage={isLastAssistant}
                />
              );
            })}

            {onboardingMode === 'predefined' && !draftRoadmap && (
               <div className="h-full w-full py-8">
                  <GoalSelectionGrid onSelect={handlePredefinedGoal} loading={loading} />
               </div>
            )}

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
                  <header className="mb-8 relative z-10">
                    <span className="font-label text-[10px] tracking-[0.3em] text-primary uppercase font-bold bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                      {onboardingMode === 'youtube' ? 'Extracted Learning Path' : 'Proposed Learning Path'}
                    </span>
                    <h3 className="text-4xl font-black font-headline uppercase mt-4 tracking-tighter italic">
                      {onboardingMode === 'youtube' ? 'Draft Generated' : 'Learning Draft'}
                    </h3>
                    {goalTitle && <p className="text-on-surface-variant/60 font-label text-[10px] uppercase tracking-[0.2em] mt-2">{goalTitle}</p>}
                  </header>

                  {phase === 'configuration' ? (
                    <div className="relative z-10 text-left animate-in fade-in zoom-in-95 duration-500">
                      <h4 className="text-xl font-bold font-headline text-white mb-6">Goal Configuration</h4>
                      
                      {/* REVISION QUIZ QUESTION PROMPT */}
                      <div className="mb-8 p-5 bg-surface-container-highest/60 border border-primary/20 rounded-2xl relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wide">
                            <HelpCircle size={18} className="text-primary shrink-0" />
                            <span>Include Revision Quizzes?</span>
                          </div>
                          <p className="text-on-surface-variant/70 text-xs font-light">
                            Would you like to attach end-of-task test quizzes for better revision & retention, or proceed with just the roadmap?
                          </p>
                        </div>

                        <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10 shrink-0 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => setIncludeQuizzes(true)}
                            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                              includeQuizzes 
                                ? 'bg-primary text-black shadow-[0_0_15px_rgba(253,184,19,0.3)]' 
                                : 'text-white/40 hover:text-white/80'
                            }`}
                          >
                            <CheckCircle2 size={14} /> Add Test Quizzes
                          </button>
                          <button
                            type="button"
                            onClick={() => setIncludeQuizzes(false)}
                            className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                              !includeQuizzes 
                                ? 'bg-white/20 text-white shadow-sm' 
                                : 'text-white/40 hover:text-white/80'
                            }`}
                          >
                            Just Roadmap
                          </button>
                        </div>
                      </div>

                      <div className="space-y-8">
                        {/* Days of week */}
                        <div>
                          <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-4">Study Days</label>
                          <div className="flex gap-2">
                            {dayNames.map((day, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (studyDays.includes(idx)) setStudyDays(studyDays.filter(d => d !== idx));
                                  else setStudyDays([...studyDays, idx].sort());
                                }}
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                                  studyDays.includes(idx) ? 'bg-primary text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Session Times */}
                        <div>
                          <label className="text-xs font-bold text-white/40 uppercase tracking-widest block mb-4">Study Sessions (Times)</label>
                          <div className="flex flex-col gap-3">
                            {studySessions.map((time, idx) => (
                              <div key={idx} className="flex items-center gap-3">
                                <input
                                  type="time"
                                  value={time}
                                  onChange={(e) => {
                                    const newSessions = [...studySessions];
                                    newSessions[idx] = e.target.value;
                                    setStudySessions(newSessions);
                                  }}
                                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary/50"
                                />
                                {studySessions.length > 1 && (
                                  <button onClick={() => setStudySessions(studySessions.filter((_, i) => i !== idx))} className="text-white/20 hover:text-red-400">
                                    <Trash2 size={18} />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              onClick={() => setStudySessions([...studySessions, '18:00'])}
                              className="w-fit text-xs font-bold text-primary flex items-center gap-2 hover:brightness-125 transition-all mt-2"
                            >
                              <Plus size={14} /> ADD SESSION
                            </button>
                          </div>
                        </div>

                        {/* Quiz Settings */}
                        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-white/5 transition-all duration-300 ${!includeQuizzes ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block">Quiz Level</label>
                              {!includeQuizzes && <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">(Disabled - Just Roadmap)</span>}
                            </div>
                            <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
                              {['easy', 'medium', 'hard'].map(level => (
                                <button
                                  key={level}
                                  type="button"
                                  disabled={!includeQuizzes}
                                  onClick={() => setQuizLevel(level)}
                                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                    quizLevel === level ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60'
                                  }`}
                                >
                                  {level}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <label className="text-xs font-bold text-white/40 uppercase tracking-widest block">Questions Per Quiz</label>
                            </div>
                            <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
                              {[5, 10, 15].map(count => (
                                <button
                                  key={count}
                                  type="button"
                                  disabled={!includeQuizzes}
                                  onClick={() => setQuizQuestions(count)}
                                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                    quizQuestions === count ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/60'
                                  }`}
                                >
                                  {count}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                      </div>

                      <div className="flex justify-end gap-4 mt-12">
                        <button onClick={() => setPhase('ready')} className="px-6 py-3 rounded-lg text-white/40 hover:text-white text-xs font-bold uppercase tracking-wider transition-all">Back</button>
                        <button onClick={handleFinalize} className="px-8 py-3 bg-primary text-black rounded-lg text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(253,184,19,0.3)]">
                          Activate Path <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 mb-12">
                        {draftRoadmap.map((task, tidx) => (
                          <div key={tidx} className="p-6 bg-surface-container-lowest/50 border border-outline-variant/10 rounded-2xl hover:border-primary/30 transition-all group">
                            <h4 className="font-bold text-sm text-primary mb-3 uppercase tracking-wide flex items-center gap-2">
                              <span className="text-[10px] opacity-40">0{tidx + 1}</span>
                              {task.title || task}
                            </h4>
                            <ul className="space-y-2">
                              {(Array.isArray(task.parts) ? task.parts : []).slice(0, 3).map((p, pidx) => {
                                const fullStr = typeof p === 'string' ? p : p?.title || String(p);
                                const cleanDisplay = fullStr.split(" || ")[0];
                                return (
                                  <li key={pidx} className="flex items-center gap-3 text-xs text-on-surface-variant font-light">
                                    <span className="w-1 h-1 bg-primary/40 rounded-full"></span>
                                    {cleanDisplay}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 relative z-10 pt-6 border-t border-outline-variant/10">
                        <button onClick={() => setPhase('configuration')} className="group relative px-10 py-5 bg-primary text-on-primary-container rounded-full overflow-hidden transition-all duration-300 active:scale-95 shadow-2xl shadow-primary/40 w-full sm:w-auto">
                          <span className="relative z-10 font-label font-bold tracking-[0.4em] uppercase text-xs">Configure Goal</span>
                          <div className="absolute inset-0 bg-gradient-to-r from-secondary to-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </button>
                        <button onClick={handleRefine} className="px-10 py-5 bg-surface-container-highest/50 text-on-surface-variant hover:text-primary border border-outline-variant/20 rounded-full font-label font-bold tracking-[0.3em] uppercase text-[10px] transition-all hover:bg-primary/5 hover:border-primary/30 w-full sm:w-auto">
                          New Draft
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {onboardingMode === 'chat' && messages.length > 0 && (
            <div className="p-3 sm:p-8 border-t border-outline-variant/10 bg-surface-container-low/50">
              <form onSubmit={handleSendMessage} className="relative group max-w-4xl mx-auto">
                {selectedFile && (
                  <div className="mb-3 flex items-center justify-between bg-surface-container-highest border border-outline-variant/20 px-4 py-2 rounded-xl text-xs text-on-surface">
                    <div className="flex items-center gap-2 truncate">
                      <FileText size={16} className="text-primary shrink-0" />
                      <span className="truncate">{selectedFile.name}</span>
                    </div>
                    <button type="button" onClick={() => setSelectedFile(null)} className="text-on-surface-variant hover:text-white p-1">
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="relative flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload File"
                    className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors p-1 z-10"
                  >
                    <Paperclip size={20} />
                  </button>
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isTyping}
                    placeholder="Respond to Edxiom or attach a file..."
                    className="w-full bg-surface-container-lowest/80 border border-outline-variant/20 rounded-xl sm:rounded-2xl pl-12 sm:pl-14 py-3.5 sm:py-5 pr-14 sm:pr-20 text-on-surface text-sm font-light focus:ring-2 focus:ring-primary/40 outline-none transition-all shadow-2xl"
                  />
                  <button type="submit" disabled={(!inputText.trim() && !selectedFile) || isTyping} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-primary text-on-primary-container rounded-lg sm:rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-lg shadow-primary/20">
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
