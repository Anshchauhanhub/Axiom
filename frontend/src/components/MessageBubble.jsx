import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, Globe } from 'lucide-react';

const MessageBubble = ({ message, role, phase }) => {
  const isAI = role === 'assistant';

  return (
    <div className={`flex w-full gap-4 ${isAI ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      {isAI && (
        <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
          <Bot size={20} className="text-primary" />
        </div>
      )}

      <div className={`max-w-[85%] px-4 py-3 rounded-[2rem] shadow-2xl relative group ${
        isAI 
          ? 'bg-surface-container-low border border-outline-variant/10 text-on-surface rounded-tl-none' 
          : 'bg-primary border border-primary/20 text-on-primary-container rounded-tr-none'
      }`}>
        {/* Tool Badge if searching */}
        {isAI && phase === 'syllabus' && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-0.5 bg-secondary/10 border border-secondary/20 rounded-full w-fit">
            <Globe size={10} className="text-secondary animate-pulse" />
            <span className="text-[8px] font-label font-bold text-secondary uppercase tracking-widest">Neural Search Active</span>
          </div>
        )}

        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown
            components={{
              p: ({ node, ...props }) => <p className="text-xs leading-relaxed font-light m-0" {...props} />,
              strong: ({ node, ...props }) => <strong className="font-bold text-primary" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc ml-4 space-y-1 mt-2" {...props} />,
              li: ({ node, ...props }) => <li className="text-xs font-light" {...props} />,
              code: ({ node, inline, ...props }) => 
                inline 
                  ? <code className="bg-surface-container-highest px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                  : <pre className="bg-surface-container-highest p-4 rounded-xl overflow-x-auto mt-2"><code className="text-xs font-mono" {...props} /></pre>
            }}
          >
            {message}
          </ReactMarkdown>
        </div>


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
