
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { ChefHat, Lock, Mail, ArrowRight, Loader2, AlertCircle, UserCheck } from 'lucide-react';
import { APP_DATA_VERSION } from '../constants';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      setLoading(false);
      
      const lowerEmail = email.toLowerCase();
      
      // Hardcoded Credentials for Production Deployment / Demo
      if (lowerEmail === 'admin@biharichatkara.com' && password === 'admin123') {
          onLogin({ id: 'u1', name: 'Administrator', email: lowerEmail, role: UserRole.MANAGER });
      } 
      else if (lowerEmail === 'chef@biharichatkara.com' && password === 'chef123') {
          onLogin({ id: 'u2', name: 'Head Chef', email: lowerEmail, role: UserRole.CHEF });
      }
      else if (lowerEmail === 'server@biharichatkara.com' && password === 'server123') {
          onLogin({ id: 'u3', name: 'Staff Member', email: lowerEmail, role: UserRole.SERVER });
      }
      else {
          setError('Invalid email or password.');
      }
    }, 800);
  };

  const fillDemo = (role: 'admin' | 'chef' | 'server') => {
      if (role === 'admin') { setEmail('admin@biharichatkara.com'); setPassword('admin123'); }
      if (role === 'chef') { setEmail('chef@biharichatkara.com'); setPassword('chef123'); }
      if (role === 'server') { setEmail('server@biharichatkara.com'); setPassword('server123'); }
      setError('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative z-10">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-700 p-8 text-center relative overflow-hidden">
          <div className="mx-auto w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 ring-4 ring-white/10 shadow-lg relative z-10">
            <ChefHat size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 font-serif tracking-wide relative z-10">Bihari Chatkara</h1>
          <p className="text-orange-100 text-xs uppercase tracking-[0.2em] font-medium relative z-10">Restaurant Management System</p>
        </div>

        {/* Form */}
        <div className="p-8 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-slate-700">Password</label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <>Login <ArrowRight size={20} /></>}
            </button>
          </form>
        </div>

        {/* Demo Login Helpers */}
        <div className="px-8 pb-8 pt-2 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3 text-center">Quick Demo Login</p>
            <div className="grid grid-cols-3 gap-2">
                <button onClick={() => fillDemo('admin')} className="flex flex-col items-center justify-center p-2 rounded-lg border border-slate-200 bg-white hover:border-orange-300 hover:shadow-sm transition-all group">
                    <UserCheck size={16} className="text-slate-400 group-hover:text-orange-500 mb-1"/>
                    <span className="text-[10px] font-bold text-slate-600">Admin</span>
                </button>
                <button onClick={() => fillDemo('chef')} className="flex flex-col items-center justify-center p-2 rounded-lg border border-slate-200 bg-white hover:border-orange-300 hover:shadow-sm transition-all group">
                    <ChefHat size={16} className="text-slate-400 group-hover:text-orange-500 mb-1"/>
                    <span className="text-[10px] font-bold text-slate-600">Chef</span>
                </button>
                <button onClick={() => fillDemo('server')} className="flex flex-col items-center justify-center p-2 rounded-lg border border-slate-200 bg-white hover:border-orange-300 hover:shadow-sm transition-all group">
                    <UserCheck size={16} className="text-slate-400 group-hover:text-orange-500 mb-1"/>
                    <span className="text-[10px] font-bold text-slate-600">Staff</span>
                </button>
            </div>
        </div>
      </div>
      
      {/* Version Indicator */}
      <div className="absolute bottom-4 right-4 text-slate-600 font-mono text-xs opacity-50 hover:opacity-100 transition-opacity">
          System v{APP_DATA_VERSION}
      </div>
    </div>
  );
};

export default Login;
