import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import NeuralLoader from '../components/NeuralLoader';
import { BookText, ChevronRight, History, Activity } from 'lucide-react';

const Notebooks = () => {
  const { user } = useAuth();
  const { goals, loading } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="animate-in fade-in duration-700 min-h-screen pb-24 relative">
      {loading && <NeuralLoader message="Accessing Notebook Archives" />}

      {/* Background glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 blur-[120px] rounded-[100%] pointer-events-none"></div>

      <div className="w-full mx-auto relative z-10 px-4 sm:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12 pt-8">
          <div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tighter text-on-surface mb-1 font-headline uppercase flex items-center gap-4">
              <BookText className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
              Notebooks Hub
            </h2>
            <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-[0.3em] mt-2">
              Neural Network Archives // Active Knowledge Base
            </p>
          </div>
          <div className="hidden sm:block">
             <span className="text-[10px] font-label font-bold uppercase tracking-[0.2em] text-on-surface-variant border border-white/10 px-4 py-2 rounded-lg bg-surface-container-lowest shadow-lg">
                {goals.length} Archives Found
             </span>
          </div>
        </div>

        {/* Notebook Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {goals.length === 0 ? (
            <div className="col-span-full h-[400px] flex flex-col items-center justify-center text-center opacity-30 bg-surface-container-lowest border border-dashed border-white/10 rounded-[2.5rem]">
              <History className="w-12 h-12 mb-4 stroke-[1.5]" />
              <span className="text-xs font-label font-bold uppercase tracking-[0.2em] mb-2">No Notebooks Found</span>
              <p className="text-[10px] max-w-sm">Create a new learning path to establish a neural notebook.</p>
            </div>
          ) : (
            goals.map((goal) => {
              const isActive = goal.status === 'active';

              return (
                <div 
                  key={goal.id}
                  className="bg-surface-container-low/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 sm:p-8 flex flex-col hover:border-white/10 hover:bg-surface-container-low transition-all shadow-lg group"
                >
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-container border border-white/5 flex items-center justify-center">
                        <BookText className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
                      </div>
                      <span className="text-[10px] font-label font-black tracking-[0.2em] uppercase text-on-surface">Notebook</span>
                    </div>

                  </div>

                  <h3 className="text-[15px] sm:text-base font-headline font-black text-on-surface mb-2 line-clamp-2 uppercase tracking-tight group-hover:text-primary transition-colors leading-[1.3]">
                    {goal.title}
                  </h3>

                  <div className="flex items-center gap-2 mb-8">
                    <span className="text-[8px] font-label font-bold uppercase tracking-[0.2em] flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-primary animate-pulse' : 'bg-on-surface-variant/30'}`}></span>
                        <span className={isActive ? 'text-primary/80' : 'text-on-surface-variant/50'}>
                            {isActive ? 'Active Path' : 'Archived'}
                        </span>
                    </span>
                  </div>
                  
                  <div className="mt-auto">
                    <button
                        onClick={() => navigate('/study', { state: { openNotebook: true, goalId: goal.id } })}
                        className="w-full py-3.5 bg-primary text-on-primary-container rounded-xl font-label text-[10px] font-black tracking-[0.2em] uppercase transition-all shadow-md shadow-primary/20 hover:brightness-110 flex items-center justify-center"
                    >
                        Open Editor
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Notebooks;
