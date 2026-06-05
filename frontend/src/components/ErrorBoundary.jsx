import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl text-red-500">warning</span>
          </div>
          <h1 className="text-3xl font-black font-headline text-on-surface mb-2 uppercase tracking-tight">System Glitch</h1>
          <p className="text-on-surface-variant max-w-md mb-8">
            Our neural pathways encountered an unexpected anomaly. We've logged the issue.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-primary text-black font-bold rounded-xl hover:bg-primary/90 transition-colors uppercase tracking-widest text-xs"
          >
            Reinitialize System
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
