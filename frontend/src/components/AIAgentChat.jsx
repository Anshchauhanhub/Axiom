import React, { useState, useEffect, useRef } from 'react';
import { onboardingChat, getChatSessions, getSessionMessages } from '../services/api';
import MessageBubble from './MessageBubble';
import { Sparkles, History, RefreshCcw, MessageSquarePlus, PanelRight, Maximize2, Minimize2, Minus, FileText, Languages, Search, CheckSquare, Send, MessageSquare, PanelRightClose } from 'lucide-react';

const AIAgentChat = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // New State for Toolbar Functionality
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isSidebarMode, setIsSidebarMode] = useState(false); // Toggles between floating panel and right sidebar
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Fetch chat sessions when history is opened
  useEffect(() => {
    if (showHistory && isOpen) {
      fetchSessions();
    }
  }, [showHistory, isOpen]);

  const fetchSessions = async () => {
    try {
      const data = await getChatSessions();
      setSessions(data?.sessions || []);
    } catch (e) {
      console.error('Failed to fetch chat sessions', e);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const data = await getSessionMessages(sessionId);
      setMessages(data?.messages || []);
      setCurrentSessionId(sessionId);
      setShowHistory(false); // Close history after selection
    } catch (e) {
      console.error('Failed to load session', e);
    }
  };

  const handleSend = async (text = input) => {
    if (!text.trim() || loading) return;

    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (text === input) setInput('');
    setLoading(true);

    try {
      // Pass the current session ID if it exists so the backend groups them
      const res = await onboardingChat(newMessages, currentSessionId);
      if (res && res.response) {
         setMessages([...newMessages, { role: 'assistant', content: res.response }]);
         // The backend might return a new session ID if one was created
         if (res.session_id && !currentSessionId) {
             setCurrentSessionId(res.session_id);
         }
      }
    } catch (error) {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (actionText) => {
    handleSend(actionText);
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setShowHistory(false);
  };

  const refreshCurrentChat = () => {
    // If there's a session, we could re-fetch it. For now, just clear local state.
    setMessages([]);
  };

  // Determine dynamic classes based on modes
  const layoutClasses = isSidebarMode 
    ? `top-0 right-0 h-screen rounded-none ${isExpanded ? 'w-full md:w-[800px]' : 'w-full max-w-[400px]'}`
    : `bottom-4 right-4 lg:bottom-6 lg:right-6 h-[600px] max-h-[calc(100vh-40px)] rounded-2xl ${isExpanded ? 'w-[calc(100%-32px)] md:w-[800px]' : 'w-[calc(100%-32px)] max-w-[400px]'}`;

  return (
    <>
      {/* Chat Panel */}
      <div className={`fixed z-[200] flex flex-row shadow-[0_20px_60px_rgba(0,0,0,0.8)] bg-surface-container-low border border-white/10 transition-all duration-500 ease-in-out overflow-hidden origin-bottom-right ${
        isOpen 
          ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 scale-95 translate-y-10 pointer-events-none'
        } ${layoutClasses}`}>
        
        {/* History Overlay Panel */}
        <div className={`absolute inset-0 bg-surface-container-lowest z-20 flex flex-col transition-transform duration-300 ${showHistory ? 'translate-x-0' : '-translate-x-full'}`}>
           <div className="flex items-center justify-between p-4 border-b border-white/10">
             <h3 className="font-bold text-on-surface">Conversations</h3>
             <button onClick={() => setShowHistory(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-on-surface-variant transition-colors">
               <Minus size={16} className="rotate-45" /> {/* Makes it look like an X */}
             </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 flex flex-col">
             {sessions.length === 0 ? (
               <div className="flex-1 flex items-center justify-center text-sm text-on-surface-variant">
                 No past conversations
               </div>
             ) : (
               <div className="space-y-2">
                 {sessions.map(s => (
                   <button 
                     key={s.id}
                     onClick={() => loadSession(s.id)}
                     className={`w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-3 transition-colors ${currentSessionId === s.id ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-container hover:bg-surface-container-high text-on-surface border border-white/5'}`}
                   >
                     <MessageSquare size={16} className="opacity-70 shrink-0" />
                     <span className="truncate flex-1">{s.title || 'Conversation'}</span>
                   </button>
                 ))}
               </div>
             )}
           </div>
           
           <div className="p-4 border-t border-white/10 bg-surface-container-low">
             <button onClick={startNewChat} className="w-full py-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-white/10 text-on-surface flex items-center justify-center gap-2 transition-colors text-sm font-medium">
               <RefreshCcw size={14} />
               New conversation
             </button>
           </div>
        </div>

        <div className="flex-1 flex flex-col h-full min-w-0 relative">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-surface-container-highest/50">
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-primary hidden sm:block" />
            </div>
            
            <div className="flex items-center gap-0.5 sm:gap-1 text-on-surface-variant">
              <button onClick={() => setShowHistory(!showHistory)} title="History" className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${showHistory ? 'bg-white/10 text-white' : 'hover:bg-white/10'}`}><History size={16} /></button>
              <button onClick={refreshCurrentChat} title="Reset" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"><RefreshCcw size={16} /></button>
              <button onClick={startNewChat} title="New Chat" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"><MessageSquarePlus size={16} /></button>
              <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
              <button onClick={() => setIsSidebarMode(!isSidebarMode)} title="Toggle Layout" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                {isSidebarMode ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
              </button>
              <button onClick={() => setIsExpanded(!isExpanded)} title="Expand/Collapse" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
              <button onClick={onClose} title="Minimize" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"><Minus size={16} /></button>
            </div>
          </div>

          {/* Messages / Empty State */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-surface-container-lowest/50 relative">
            
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-700 max-w-sm mx-auto">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-green-500 flex items-center justify-center p-1.5 shadow-xl shadow-yellow-500/10 mb-6 relative" style={{ borderRadius: '50%' }}>
                  <img 
                    src="https://api.dicebear.com/7.x/bottts-neutral/svg?seed=AxiomMaster&backgroundColor=transparent&radius=50" 
                    alt="AI Agent"
                    style={{ borderRadius: '50%' }}
                    className="w-full h-full object-cover bg-surface-container-low rounded-full"
                  />
                  <div className="absolute top-0 right-0 w-4 h-4 bg-white rounded-full border-2 border-green-500"></div>
                </div>
                <h2 className="text-xl font-bold text-on-surface mb-8">On call and ready, how can I help?</h2>
                
                <div className="w-full space-y-2">
                  <button onClick={() => handleQuickAction('Summarize this page')} className="w-full flex items-center gap-4 p-4 rounded-xl bg-surface-container hover:bg-surface-container-highest border border-white/5 transition-colors group text-left">
                    <FileText size={20} className="text-on-surface-variant group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">Summarize this page</span>
                  </button>
                  <button onClick={() => handleQuickAction('Translate this page')} className="w-full flex items-center gap-4 p-4 rounded-xl bg-surface-container hover:bg-surface-container-highest border border-white/5 transition-colors group text-left">
                    <Languages size={20} className="text-on-surface-variant group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">Translate this page</span>
                  </button>
                  <button onClick={() => handleQuickAction('Analyze for insights')} className="w-full flex items-center gap-4 p-4 rounded-xl bg-surface-container hover:bg-surface-container-highest border border-white/5 transition-colors group text-left">
                    <Search size={20} className="text-on-surface-variant group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">Analyze for insights</span>
                  </button>
                  <button onClick={() => handleQuickAction('Create a task tracker')} className="w-full flex items-center gap-4 p-4 rounded-xl bg-surface-container hover:bg-surface-container-highest border border-white/5 transition-colors group text-left">
                    <CheckSquare size={20} className="text-on-surface-variant group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">Create a task tracker</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, idx) => (
                   <MessageBubble key={idx} message={m.content} role={m.role} />
                ))}
                {loading && (
                   <div className="flex items-center gap-3 text-primary animate-pulse py-4">
                      <Sparkles size={16} />
                      <p className="text-[10px] uppercase tracking-[0.3em] font-label font-black">Synthesizing response...</p>
                   </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/10 bg-surface-container-highest/80 backdrop-blur-md">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative flex items-center w-full bg-surface-container border border-white/10 rounded-[2rem] p-1.5 focus-within:border-primary/50 transition-colors">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Do anything with AI..."
                className="flex-1 bg-transparent text-sm text-on-surface py-2 pl-4 outline-none border-none ring-0 focus:outline-none focus:ring-0 focus:border-transparent shadow-none font-light placeholder:text-on-surface-variant/50"
              />
              <div className="flex items-center gap-2 pr-1">
                <button 
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary hover:text-black transition-colors"
                >
                  <Send size={14} className="ml-0.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default AIAgentChat;
