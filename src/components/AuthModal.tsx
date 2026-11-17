import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import * as api from '../services/api';
import type { Profile } from '../types/portal';
import { CollegeLogo } from './CollegeLogo';

export type AuthModalMode = 'login' | 'register' | 'forgot_password' | 'setup_principal';

interface AuthModalProps {
  onClose?: () => void;
  onAuthenticated: (profile: Profile) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onClose,
  onAuthenticated,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);

  // Shared real email + password credentials
  const [name, setName] = useState('');
  const [principalName, setPrincipalName] = useState('College Principal');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const switchMode = (nextMode: AuthModalMode) => {
    setMode(nextMode);
    setError(null);
    setSuccessMsg(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const profile = await api.loginWithEmail(email, password);
      onAuthenticated(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const profile = await api.registerStudent(name, email, password);
      onAuthenticated(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await api.sendResetPasswordEmail(email);
      setSuccessMsg(
        `Password reset link ${email.trim().toLowerCase()} par bhej diya gaya hai. Please check your Inbox or Spam folder.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPrincipalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const profile = await api.setupPrincipalAccount(principalName, email, password);
      onAuthenticated(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initialize Principal account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-xl my-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <CollegeLogo className="w-10 h-10 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                SKM&apos;S J.M. Patel College of Commerce
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sign in with your college or personal email
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sign in dialog"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {(mode === 'login' || mode === 'register') && (
          <div className="mt-5 grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In (All Roles)
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Student Register
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 flex items-start gap-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{successMsg}</span>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Students, Committee Members, and Principal can sign in here using their registered
              email and password.
            </p>

            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot_password')}
                  className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-11 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            </button>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Setting up portal for the first time?
              </span>
              <button
                type="button"
                onClick={() => switchMode('setup_principal')}
                className="font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Setup Principal
              </button>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="mt-5 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              New student at SKM&apos;S J.M. Patel College of Commerce? Register using your real email
              address.
            </p>

            <div>
              <label
                htmlFor="student-name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="student-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rohan Sharma"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="student-email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="student-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="student-password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Password (min 6 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="student-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-11 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>{loading ? 'Creating account...' : 'Register Student Account'}</span>
            </button>
          </form>
        )}

        {mode === 'forgot_password' && (
          <form onSubmit={handleForgotPasswordSubmit} className="mt-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Reset Password</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Apna registered email address daalein. Hum aapko password reset karne ka link bhej
                denge.
              </p>
            </div>

            <div>
              <label
                htmlFor="reset-email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>{loading ? 'Sending link...' : 'Send Password Reset Link'}</span>
            </button>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </form>
        )}

        {mode === 'setup_principal' && (
          <form onSubmit={handleSetupPrincipalSubmit} className="mt-5 space-y-4">
            <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                One-time setup to register the single Principal admin account using the
                Principal&apos;s real email address.
              </span>
            </div>

            <div>
              <label
                htmlFor="principal-name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Principal Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="principal-name"
                  type="text"
                  required
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  placeholder="e.g. Dr. Principal Name"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="principal-email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Principal Real Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="principal-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="principal@college.edu.in"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="principal-password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
              >
                Create Principal Password (min 8 chars)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="principal-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-11 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>
                {loading ? 'Initializing...' : 'Initialize Principal Admin Account'}
              </span>
            </button>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
