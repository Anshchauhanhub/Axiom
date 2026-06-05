import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, register, validatePassword, forgotPassword, resetPassword, googleLogin } from '../services/api';
import { useGoogleLogin } from '@react-oauth/google';
import { 
  ShieldCheck, Mail, Lock, ArrowRight, 
  UserPlus, LogIn, Sparkles, AlertCircle,
  Eye, EyeOff, CheckCircle2, XCircle, Send
} from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loginUser } = useAuth();
  
  const queryParams = new URLSearchParams(location.search);
  const resetToken = queryParams.get('reset_token');
  
  const initialMode = resetToken ? 'reset-password' : (location.pathname.includes('register') ? 'register' : 'login');
  const [mode, setMode] = useState(initialMode);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
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
    if (mode === 'register' || mode === 'reset-password') {
      setPwRequirements(validatePassword(password));
    } else {
      setPwRequirements([]);
    }
  }, [password, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      if (mode === 'forgot-password') {
        const res = await forgotPassword(email);
        setSuccessMsg(res.message);
      } else if (mode === 'reset-password') {
        const res = await resetPassword(resetToken, password);
        setSuccessMsg(res.message);
        setTimeout(() => setMode('login'), 3000);
      } else {
        const fn = mode === 'register' ? register : login;
        const res = await fn(email, password);
        await loginUser(res.access_token);
        navigate('/onboarding');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
        setError('');
        const res = await googleLogin(tokenResponse.access_token);
        await loginUser(res.access_token);
        navigate('/onboarding');
      } catch (err) {
        alert("API Error (/auth/google): " + err.message);
        setError(err.message || 'Google authentication failed');
        setLoading(false);
      }
    },
    onError: () => setError('Google authentication failed'),
  });

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
            {mode === 'login' ? 'Sign in to continue your journey' : 
             mode === 'register' ? 'Create your account to get started' : 
             mode === 'forgot-password' ? 'Reset your password' : 'Enter your new password'}
          </p>
        </div>

        <div className="auth-glass rounded-[3rem] border border-white/5 p-8 sm:p-10 shadow-[0_40px_100px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Subtle Scanner Line */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent auth-scan" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {mode !== 'reset-password' && (
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
            )}

            {mode !== 'forgot-password' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-label font-black text-primary uppercase tracking-[0.2em] ml-1">
                    {mode === 'reset-password' ? 'New Password' : 'Password'}
                  </label>
                  {mode === 'login' && (
                     <button type="button" onClick={() => setMode('forgot-password')} className="text-[9px] font-label font-bold text-on-surface-variant/40 hover:text-primary uppercase tracking-widest transition-colors">
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
                
                {(mode === 'register' || mode === 'reset-password') && (
                  <div className="pt-2 px-2 grid grid-cols-2 gap-y-2">
                     <RequirementItem text="8+ Characters" met={password.length >= 8} />
                     <RequirementItem text="Uppercase" met={/[A-Z]/.test(password)} />
                     <RequirementItem text="Lowercase" met={/[a-z]/.test(password)} />
                     <RequirementItem text="Digit" met={/[0-9]/.test(password)} />
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-4 rounded-2xl bg-error/10 border border-error/20 animate-bounce">
                <AlertCircle className="text-error" size={16} />
                <p className="text-[11px] font-label font-bold text-error uppercase tracking-widest">{error}</p>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 p-4 rounded-2xl bg-primary/10 border border-primary/20">
                <CheckCircle2 className="text-primary" size={16} />
                <p className="text-[11px] font-label font-bold text-primary uppercase tracking-widest">{successMsg}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || ((mode === 'register' || mode === 'reset-password') && pwRequirements.length > 0)}
              className="group relative w-full py-5 bg-primary text-black rounded-2xl overflow-hidden transition-all duration-500 shadow-[0_20px_40px_rgba(253,184,19,0.2)] hover:shadow-[0_20px_50px_rgba(253,184,19,0.4)] hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-secondary to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10 flex items-center justify-center gap-3">
                <span className="font-label font-black text-xs uppercase tracking-[0.3em]">
                  {loading ? 'Processing...' : (
                    mode === 'login' ? 'Sign In' : 
                    mode === 'register' ? 'Sign Up' : 
                    mode === 'forgot-password' ? 'Send Reset Link' : 'Update Password'
                  )}
                </span>
                {!loading && (mode === 'forgot-password' ? <Send size={16} className="group-hover:translate-x-1 transition-transform" /> : <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />)}
              </div>
            </button>
          </form>

          {(mode === 'login' || mode === 'register') && (
            <div className="mt-6">
              <div className="relative flex items-center justify-center py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative bg-[#0a0a0b] px-4 text-[10px] font-label font-bold text-on-surface-variant/40 uppercase tracking-widest">
                  Or continue with
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleGoogleAuth()}
                disabled={loading}
                className="w-full mt-2 py-4 flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all duration-300 disabled:opacity-50"
              >
                <svg width="20" height="20" viewBox="0 0 48 48" className="mr-1">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span className="font-label font-bold text-xs uppercase tracking-widest text-white/90">
                  Google
                </span>
              </button>
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-white/5 text-center">
             <button 
                onClick={() => setMode(
                  mode === 'login' ? 'register' : 
                  mode === 'forgot-password' ? 'login' :
                  mode === 'reset-password' ? 'login' : 'login'
                )}
                className="group inline-flex items-center gap-3 text-on-surface-variant/60 hover:text-primary transition-all duration-300"
             >
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-primary/40 transition-all">
                  {(mode === 'login' || mode === 'reset-password') ? <UserPlus size={14} /> : <LogIn size={14} />}
                </div>
                <span className="font-label text-[10px] font-black uppercase tracking-[0.2em]">
                  {mode === 'login' ? "Don't have an account? Sign Up" : 
                   mode === 'forgot-password' || mode === 'reset-password' ? "Back to Sign In" : 'Already have an account? Sign In'}
                </span>
             </button>
          </div>
        </div>
      </div>

      <style>{`
        .auth-glass {
          background: rgba(14, 14, 16, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .drop-shadow-glow {
          filter: drop-shadow(0 0 20px rgba(253, 184, 19, 0.4));
        }
        @keyframes auth-scan-kf {
          0% { transform: translateY(-100%); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: translateY(1000%); opacity: 0; }
        }
        .auth-scan {
          animation: auth-scan-kf 4s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Auth;
