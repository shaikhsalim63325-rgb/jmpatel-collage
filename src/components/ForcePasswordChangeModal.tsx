import React, { useState } from 'react';
import { KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import * as api from '../services/api';
import type { Profile } from '../types/portal';

interface ForcePasswordChangeModalProps {
  profile: Profile;
  onSuccess: (updatedProfile: Profile) => void;
  onLogout: () => void;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({
  profile,
  onSuccess,
  onLogout,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await api.changePassword(newPassword);
      onSuccess(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 text-blue-800 dark:text-blue-400">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Set Your Personal Password
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              First-login security requirement · {profile.email || profile.name}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Your account was provisioned with a temporary password by the Principal. Please choose a
          new private password before entering your committee dashboard.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="force-new-password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
            >
              New Password
            </label>
            <input
              id="force-new-password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="force-confirm-password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5"
            >
              Confirm New Password
            </label>
            <input
              id="force-confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 px-4 text-sm font-semibold text-white transition-colors cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{submitting ? 'Updating...' : 'Update & Continue'}</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
