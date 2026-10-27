import React from 'react';
import { CheckCircle2, XCircle, HelpCircle, ArrowLeft, RefreshCw, Check } from 'lucide-react';

export default function QuizReview({ questions, userAnswers, onRetry, onContinue, isPassed }) {
  return (
    <div className="max-w-3xl mx-auto w-full p-6 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
        <div>
          <h2 className="text-xl font-bold text-on-surface font-headline uppercase tracking-tight flex items-center gap-2">
            <HelpCircle className="text-primary" size={22} />
            Quiz Question Breakdown
          </h2>
          <p className="text-xs text-on-surface-variant font-label uppercase tracking-widest mt-1">
            Review your answers and verified solutions
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isPassed && onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-surface-container border border-outline-variant/20 text-xs font-bold uppercase tracking-wider text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-2"
            >
              <RefreshCw size={14} /> Retry
            </button>
          )}
          {onContinue && (
            <button
              onClick={onContinue}
              className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all shadow-[0_0_15px_rgba(253,184,19,0.3)]"
            >
              Continue
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((q, qIdx) => {
          const userSelectedIdx = userAnswers?.[qIdx];
          const isCorrect = userSelectedIdx === q.correct_index;

          return (
            <div 
              key={qIdx}
              className={`p-5 rounded-2xl border transition-all ${
                isCorrect 
                  ? 'bg-green-500/[0.03] border-green-500/20' 
                  : 'bg-red-500/[0.03] border-red-500/20'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  isCorrect ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {qIdx + 1}
                </span>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-on-surface">{q.question}</h4>
                </div>
                {isCorrect ? (
                  <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                ) : (
                  <XCircle size={18} className="text-red-400 shrink-0" />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pl-9">
                {q.options.map((opt, optIdx) => {
                  const wasChosen = userSelectedIdx === optIdx;
                  const isThisCorrect = optIdx === q.correct_index;

                  let borderClass = 'border-outline-variant/10 bg-surface-container/50 text-on-surface-variant';
                  if (isThisCorrect) {
                    borderClass = 'border-green-500/50 bg-green-500/10 text-green-300 font-medium';
                  } else if (wasChosen && !isThisCorrect) {
                    borderClass = 'border-red-500/50 bg-red-500/10 text-red-300 line-through';
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`px-3 py-2 rounded-xl text-xs border flex items-center justify-between ${borderClass}`}
                    >
                      <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                      {isThisCorrect && <Check size={14} className="text-green-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>

              {q.explanation && (
                <div className="mt-3 pl-9 text-xs text-on-surface-variant bg-surface-container/30 p-3 rounded-xl border border-outline-variant/5">
                  <span className="font-bold text-primary mr-1">Explanation:</span>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
