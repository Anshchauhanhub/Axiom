import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto remove after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container fixed bottom-8 right-8 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem 
            key={toast.id} 
            toast={toast} 
            onClose={() => removeToast(toast.id)} 
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(onClose, 300); // Match animation duration
  }, [onClose]);

  return (
    <div className={`toast-item pointer-events-auto relative overflow-hidden flex items-center gap-3 px-5 py-4 rounded-2xl bg-surface-container-high/90 backdrop-blur-xl border border-outline-variant/10 shadow-2xl transition-all duration-300 ${isExiting ? 'opacity-0 translate-y-4 scale-95' : 'animate-toast-in'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        toast.type === 'success' ? 'bg-secondary/20 text-secondary' : 
        toast.type === 'error' ? 'bg-error/20 text-error' : 
        'bg-primary/20 text-primary'
      }`}>
        <span className="material-symbols-outlined text-lg">
          {toast.type === 'success' ? 'check_circle' : 
           toast.type === 'error' ? 'error' : 
           'info'}
        </span>
      </div>
      <p className="text-sm font-medium text-on-surface flex-1">{toast.message}</p>
      <button onClick={handleClose} className="text-on-surface-variant hover:text-on-surface transition-colors z-10 relative">
        <span className="material-symbols-outlined text-lg">close</span>
      </button>

      {/* Shrinking Progress Bar */}
      <style>{`
        @keyframes shrinkProgressBar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <div 
        className={`absolute bottom-0 left-0 h-1 opacity-80 ${
          toast.type === 'success' ? 'bg-secondary' : 
          toast.type === 'error' ? 'bg-error' : 
          'bg-primary'
        }`}
        style={{ animation: 'shrinkProgressBar 4s linear forwards' }}
      ></div>
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
