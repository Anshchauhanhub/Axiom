import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, Globe, BookOpen, HelpCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import InteractiveDiscoveryCard from './InteractiveDiscoveryCard';

const cleanDisplayMessage = (msg) => {
  if (!msg || typeof msg !== 'string') return '';
  return msg
    .replace(/###?\s*(DRAFT ROADMAP|GOAL TITLE|STUDY PROFILE UPDATE)[\s\S]*?(?=(###|\Z))/gi, '')
    .replace(/\[\s*\{\s*"title"[\s\S]*?\}\s*\]/gi, '')
    .replace(/\{\s*"(target_exam|months_remaining|study_hours_per_day|learning_style|message|phase)"[\s\S]*?\}/gi, '')
    .trim();
};

const MessageBubble = ({ message, role, phase, onDiscoverySubmit, targetExam, isLastAssistantMessage }) => {
  const isAI = role === 'assistant';
  const showDiscoveryCard = isAI && phase === 'syllabus_review' && isLastAssistantMessage && onDiscoverySubmit;
  const displayMessage = isAI ? cleanDisplayMessage(message) : message;

  return (
    <div className={`flex w-full gap-4 ${isAI ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      {isAI && (
        <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
          <Bot size={20} className="text-primary" />
        </div>
      )}

      <div className={`max-w-[85%] px-5 py-4 rounded-[2rem] shadow-2xl relative group ${
        isAI 
          ? 'bg-surface-container-low border border-outline-variant/10 text-on-surface rounded-tl-none space-y-3' 
          : 'bg-primary border border-primary/20 text-on-primary-container rounded-tr-none'
      }`}>
        {/* Tool Badge if searching */}
        {isAI && phase === 'syllabus' && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-0.5 bg-secondary/10 border border-secondary/20 rounded-full w-fit">
            <Globe size={10} className="text-secondary animate-pulse" />
            <span className="text-[8px] font-label font-bold text-secondary uppercase tracking-widest">Search Active</span>
          </div>
        )}

        <div className="prose prose-sm prose-invert max-w-none space-y-3">
          <ReactMarkdown
            components={{
              p: ({ node, ...props }) => <p className="text-xs leading-relaxed font-light m-0 text-on-surface/90" {...props} />,
              h3: ({ node, children, ...props }) => {
                const text = String(children);
                const isSyllabus = text.toLowerCase().includes('syllabus') || text.toLowerCase().includes('topic');
                const isQuestions = text.toLowerCase().includes('question') || text.toLowerCase().includes('step') || text.toLowerCase().includes('next');

                return (
                  <div className={`my-3 p-3 rounded-2xl border backdrop-blur-md flex items-center gap-2.5 ${
                    isSyllabus 
                      ? 'bg-primary/10 border-primary/30 text-primary shadow-[0_0_20px_rgba(253,184,19,0.1)]' 
                      : isQuestions
                        ? 'bg-secondary/10 border-secondary/30 text-secondary'
                        : 'bg-surface-container-highest/60 border-outline-variant/20 text-white'
                  }`}>
                    {isSyllabus ? <BookOpen size={18} className="shrink-0 text-primary" /> : isQuestions ? <HelpCircle size={18} className="shrink-0 text-secondary" /> : <Sparkles size={18} className="shrink-0 text-purple-400" />}
                    <h3 className="text-xs font-headline font-bold uppercase tracking-wider m-0 text-current" {...props}>
                      {children}
                    </h3>
                  </div>
                );
              },
              strong: ({ node, ...props }) => <strong className="font-bold text-primary" {...props} />,
              ul: ({ node, ...props }) => <ul className="space-y-1.5 my-2 pl-0 list-none" {...props} />,
              ol: ({ node, ...props }) => <ol className="space-y-2 my-2 pl-0 list-none" {...props} />,
              li: ({ node, children, ...props }) => (
                <li className="flex items-start gap-2.5 text-xs font-light bg-black/20 p-2.5 rounded-xl border border-white/5 hover:border-primary/20 transition-all" {...props}>
                  <CheckCircle2 size={14} className="text-primary/70 shrink-0 mt-0.5" />
                  <div className="flex-1 text-on-surface-variant/90">{children}</div>
                </li>
              ),
              code: ({ node, className, children, ...props }) => {
                const isBlock = /language-/.test(className || '');
                return isBlock 
                  ? <pre className="bg-surface-container-highest p-4 rounded-xl overflow-x-auto my-2"><code className="text-xs font-mono" {...props}>{children}</code></pre>
                  : <code className="bg-surface-container-highest px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>;
              }
            }}
          >
            {displayMessage}
          </ReactMarkdown>
        </div>

        {/* Embedded Interactive Discovery Form Widget */}
        {showDiscoveryCard && (
          <div className="mt-4 pt-2">
            <InteractiveDiscoveryCard 
              targetExam={targetExam || "Your Target Goal"} 
              onSubmitPreferences={onDiscoverySubmit} 
            />
          </div>
        )}
      </div>

      {!isAI && (
        <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-surface-container-high flex items-center justify-center border border-outline-variant/10 shadow-lg">
          <User size={20} className="text-on-surface-variant" />
        </div>
      )}
    </div>
  );
};



export default MessageBubble;
