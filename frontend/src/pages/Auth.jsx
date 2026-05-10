import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, register, validatePassword } from '../services/api';
import { 
  ShieldCheck, Mail, Lock, ArrowRight, 
  UserPlus, LogIn, Sparkles, AlertCircle,
  Eye, EyeOff, CheckCircle2, XCircle
} from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loginUser } = useAuth();
  
  // URL may specify mode (e.g., /login or /register)
  const initialMode = location.pathname.includes('register') ? 'register' : 'login';
  const [mode, setMode] = useState(initialMode);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pwRequirements, setPwRequirements] = useState([]);

  // Particle background logic
  const canvasRef = useRef(null);

  useEffect(() => {
    if (user) navigate('/onboarding');
  }, [user, navigate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let particles = [];
    const particleCount = 60;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 1.5;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(253, 184, 19, 0.3)';
        ctx.fill();
      }
    }

    const init = () => {
      resize();
      particles = Array.from({ length: particleCount }, () => new Particle());
    };

    const drawLines = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(253, 184, 19, ${0.15 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      drawLines();
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    init();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    if (mode === 'register') {
      setPwRequirements(validatePassword(password));
    } else {
      setPwRequirements([]);
    }
  }, [password, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const fn = mode === 'register' ? register : login;
      const res = await fn(email, password);
      await loginUser(res.access_token);
      navigate('/onboarding');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const RequirementItem = ({ text, met }) => (
    <div className={`flex items-center gap-2 text-[10px] font-label font-bold uppercase tracking-widest transition-colors duration-300 ${met ? 'text-primary' : 'text-on-surface-variant/40'}`}>
      {met ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {text}
    </div>
  );

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#0a0a0b] py-12 px-4">
      {/* Dynamic Background */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      
      {/* Decorative SVG Shapes */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-primary/10 to-transparent opacity-30 pointer-events-none blur-[100px]" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-secondary/10 to-transparent opacity-20 pointer-events-none blur-[100px]" />

      <div className="relative z-10 w-full max-w-[450px] animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center justify-center w-24 h-24 rounded-[2.5rem] bg-surface-container-low border border-white/5 mb-6 shadow-2xl relative group overflow-hidden transition-transform hover:scale-110">
            <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
            <img src="/logo.png" alt="Axiom" className="w-20 h-auto relative z-10 drop-shadow-glow" />
          </Link>
          <div className="mb-4">
            <Link to="/" className="text-[9px] font-label font-bold text-on-surface-variant/40 hover:text-primary uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-2 group">
              <span className="material-symbols-outlined text-xs group-hover:-translate-x-1 transition-transform">arrow_back</span>
              Back to Website
            </Link>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black font-headline uppercase tracking-tighter text-on-surface italic leading-none mb-2">
            {mode === 'login' ? 'Welcome' : 'Join'} <span className="text-primary drop-shadow-glow">Axiom</span>
          </h1>
          <p className="text-on-surface-variant/60 font-label text-[10px] uppercase tracking-[0.3em]">
            {mode === 'login' ? 'Sign in to continue your journey' : 'Create your account to get started'}
          </p>
        </div>

        <div className="glass-morphism rounded-[3rem] border border-white/5 p-8 sm:p-10 shadow-[0_40px_100px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Subtle Scanner Line */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-scan" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-label font-black text-primary uppercase tracking-[0.2em] ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-container-lowest/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-on-surface font-label text-sm focus:ring-2 focus:ring-primary/40 focus:border-primary/20 outline-none transition-all placeholder:text-white/10"
                  placeholder="name@nexus.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-label font-black text-primary uppercase tracking-[0.2em]">Password</label>
                {mode === 'login' && (
                   <button type="button" className="text-[9px] font-label font-bold text-on-surface-variant/40 hover:text-primary uppercase tracking-widest transition-colors">
                     Forgot Password?
                   </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-container-lowest/50 border border-white/5 rounded-2xl py-4 pl-12 pr-12 text-on-surface font-label text-sm focus:ring-2 focus:ring-primary/40 focus:border-primary/20 outline-none transition-all placeholder:text-white/10"
                  placeholder="••••••••"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {mode === 'register' && (
                <div className="pt-2 px-2 grid grid-cols-2 gap-y-2">
                   <RequirementItem text="8+ Characters" met={password.length >= 8} />
                   <RequirementItem text="Uppercase" met={/[A-Z]/.test(password)} />
                   <RequirementItem text="Lowercase" met={/[a-z]/.test(password)} />
                   <RequirementItem text="Digit" met={/[0-9]/.test(password)} />
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 rounded-2xl bg-error/10 border border-error/20 animate-bounce">
                <AlertCircle className="text-error" size={16} />
                <p className="text-[11px] font-label font-bold text-error uppercase tracking-widest">{error}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || (mode === 'register' && pwRequirements.length > 0)}
              className="group relative w-full py-5 bg-primary text-black rounded-2xl overflow-hidden transition-all duration-500 shadow-[0_20px_40px_rgba(253,184,19,0.2)] hover:shadow-[0_20px_50px_rgba(253,184,19,0.4)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-secondary to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10 flex items-center justify-center gap-3">
                <span className="font-label font-black text-xs uppercase tracking-[0.3em]">
                  {loading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Sign Up')}
                </span>
                {!loading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
              </div>
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 text-center">
             <button 
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="group inline-flex items-center gap-3 text-on-surface-variant/60 hover:text-primary transition-all duration-300"
             >
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-primary/40 transition-all">
                  {mode === 'login' ? <UserPlus size={14} /> : <LogIn size={14} />}
                </div>
                <span className="font-label text-[10px] font-black uppercase tracking-[0.2em]">
                  {mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
                </span>
             </button>
          </div>
        </div>
      </div>

      <style>{`
        .glass-morphism {
          background: rgba(14, 14, 16, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .drop-shadow-glow {
          filter: drop-shadow(0 0 20px rgba(253, 184, 19, 0.4));
        }
        @keyframes scan {
          0% { transform: translateY(-100%); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: translateY(1000%); opacity: 0; }
        }
        .animate-scan {
          animation: scan 4s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Auth;
