import React, { useEffect } from 'react';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      button: 'bg-error text-white hover:bg-error/90',
      icon: 'text-error',
      bg: 'bg-error/10'
    },
    warning: {
      button: 'bg-orange-500 text-white hover:bg-orange-500/90',
      icon: 'text-orange-500',
      bg: 'bg-orange-500/10'
    },
    info: {
      button: 'bg-primary text-black hover:bg-primary/90',
      icon: 'text-primary',
      bg: 'bg-primary/10'
    }
  };

  const currentStyle = variantStyles[variant] || variantStyles.danger;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-surface-container-low border border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-12 h-12 rounded-full ${currentStyle.bg} flex items-center justify-center`}>
              <span className={`material-symbols-outlined ${currentStyle.icon} text-2xl`}>
                {variant === 'danger' ? 'warning' : variant === 'warning' ? 'error' : 'info'}
              </span>
            </div>
            <div className="pt-1">
              <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">{message}</p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg ${currentStyle.button}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
