import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register, login, createGoal, generateRoadmap } from '../services/api';
import NeuralLoader from '../components/NeuralLoader';

const Onboarding = () => {
  const { user, loginUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(user ? 2 : 1); // 1=auth, 2=goal, 3=schedule
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const fn = mode === 'register' ? register : login;
      const res = await fn(email, password);
      await loginUser(res.access_token);
      navigate('/');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleGoalSubmit = async () => {
    const title = goalTitle || customGoal;
    if (!title) return setError('Please select or type a goal.');
    setLoading(true);
    setGeneratingRoadmap(true);
    setError('');
    try {
      const goal = await createGoal(title);
      await generateRoadmap(goal.id);
      setGeneratingRoadmap(false);
      navigate('/');
    } catch (e) {
      setError(e.message);
      setGeneratingRoadmap(false);
    }
    setLoading(false);
  };

  const goalOptions = [
    { title: 'Master Backend Engineering', desc: 'Architecture, Systems, and Scalability', icon: 'database', color: 'text-primary' },
    { title: 'Advanced AI Specialization', desc: 'LLMs, Neural Nets, and Vector Databases', icon: 'psychology', color: 'text-secondary' },
    { title: 'Full-Stack Synthesis', desc: 'Modern Web Ecosystems & Cloud Infrastructure', icon: 'terminal', color: 'text-tertiary' }
  ];

  return (
    <div className="w-full flex flex-col items-center">
      {generatingRoadmap && (
        <NeuralLoader
          message="Generating Roadmap"
          subMessages={[
            'Analyzing your learning objective',
            'Building personalized task modules',
            'Calibrating difficulty progression',
            'Structuring knowledge graph',
            'Finalizing your learning path',
          ]}
        />
      )}
      {/* Step Indicator */}
      <div className="w-full max-w-2xl mb-12 flex justify-between items-center px-4">
        <div className="flex flex-col gap-1">
          <span className="font-label text-xs tracking-widest text-secondary uppercase">Session Initialization</span>
          <h2 className="text-2xl font-black tracking-tight font-headline text-on-surface">
            {step === 1 ? 'Authentication Phase' : 'Configuration Phase'}
          </h2>
        </div>
        <div className="flex gap-2">
          <div className={`h-1 w-12 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-surface-container-highest'}`}></div>
          <div className={`h-1 w-12 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-surface-container-highest'}`}></div>
          <div className={`h-1 w-12 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-surface-container-highest'}`}></div>
        </div>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start px-4">
        {/* Left Side: Contextual Info */}
        <div className="lg:col-span-4 flex flex-col gap-6 order-2 lg:order-1">
          <div className="p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/15">
            <span className="material-symbols-outlined text-primary mb-4">neurology</span>
            <h3 className="font-label text-sm font-bold text-on-surface mb-2 tracking-wide uppercase">Neural Alignment</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed">Axiom adjusts its synthesis engine based on your primary objective. Precision is key to generating the optimal roadmap.</p>
          </div>
          {error && (
            <div className="p-4 bg-error-container/20 border border-error/30 rounded-xl">
              <p className="text-error text-xs font-label font-bold">{error}</p>
            </div>
          )}
        </div>

        {/* Right Side: Interactive Content */}
        <div className="lg:col-span-8 space-y-8 order-1 lg:order-2">

          {/* STEP 1: Auth */}
          {step === 1 && (
            <section className="bg-surface-container rounded-2xl p-8 lg:p-12 relative overflow-hidden ring-1 ring-outline-variant/10">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <span className="material-symbols-outlined text-9xl">lock</span>
              </div>
              <div className="relative z-10">
                <label className="font-label text-xs font-bold text-secondary tracking-[0.2em] uppercase mb-4 block">
                  {mode === 'register' ? 'New Signal' : 'Returning Signal'}
                </label>
                <h1 className="text-4xl lg:text-5xl font-black font-headline text-on-surface mb-8 leading-tight tracking-tighter">
                  {mode === 'register' ? <>Create your <span className="text-primary">identity</span></> : <>Welcome <span className="text-primary">back</span></>}
                </h1>
                <div className="space-y-4 mb-8">
                  <input
                    className="w-full bg-surface-container-low border-none rounded-xl px-6 py-4 text-on-surface focus:ring-1 focus:ring-secondary font-label text-sm placeholder:text-outline-variant"
                    placeholder="Email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    className="w-full bg-surface-container-low border-none rounded-xl px-6 py-4 text-on-surface focus:ring-1 focus:ring-secondary font-label text-sm placeholder:text-outline-variant"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
                    className="text-xs font-label text-primary hover:underline uppercase tracking-widest"
                  >
                    {mode === 'register' ? 'Have an account? Login' : 'New here? Register'}
                  </button>
                  <button
                    onClick={handleAuth}
                    disabled={loading}
                    className="px-10 py-4 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary-container font-label text-xs font-bold tracking-widest uppercase shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? 'Connecting...' : mode === 'register' ? 'Initialize' : 'Authenticate'}
                    <span className="material-symbols-outlined text-sm">east</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP 2: Goal Selection */}
          {step === 2 && (
            <>
              <section className="bg-surface-container rounded-2xl p-8 lg:p-12 relative overflow-hidden ring-1 ring-outline-variant/10">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <span className="material-symbols-outlined text-9xl">target</span>
                </div>
                <div className="relative z-10">
                  <label className="font-label text-xs font-bold text-secondary tracking-[0.2em] uppercase mb-4 block">Question 01</label>
                  <h1 className="text-4xl lg:text-5xl font-black font-headline text-on-surface mb-8 leading-tight tracking-tighter">
                    What is your <span className="text-primary">main goal</span>?
                  </h1>
                  <div className="space-y-4">
                    {goalOptions.map((item) => (
                      <div
                        key={item.title}
                        onClick={() => { setGoalTitle(item.title); setCustomGoal(''); }}
                        className={`group cursor-pointer bg-surface-container-low p-6 rounded-xl flex items-center justify-between border transition-all duration-300 ${
                          goalTitle === item.title ? 'border-primary/40 glow-blue' : 'border-transparent hover:border-primary/20 hover:bg-surface-container-high'
                        }`}
                      >
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}>
                            <span className="material-symbols-outlined">{item.icon}</span>
                          </div>
                          <div>
                            <h4 className="font-headline font-bold text-on-surface">{item.title}</h4>
                            <p className="text-on-surface-variant text-xs font-label">{item.desc}</p>
                          </div>
                        </div>
                        {goalTitle === item.title ? (
                          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        ) : (
                          <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">arrow_forward</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-10">
                    <input
                      className="w-full bg-surface-container-low border-none rounded-xl px-6 py-4 text-on-surface focus:ring-1 focus:ring-secondary font-label text-sm placeholder:text-outline-variant"
                      placeholder="Or type your custom objective..."
                      type="text"
                      value={customGoal}
                      onChange={(e) => { setCustomGoal(e.target.value); setGoalTitle(''); }}
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-end gap-4 pt-4">
                <button
                  onClick={handleGoalSubmit}
                  disabled={loading}
                  className="px-10 py-4 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary-container font-label text-xs font-bold tracking-widest uppercase shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? 'Generating Roadmap...' : 'Generate Roadmap'}
                  <span className="material-symbols-outlined text-sm">east</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
