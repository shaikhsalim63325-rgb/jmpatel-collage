import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { ToastMessage } from '../types/portal';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-16 md:top-5 right-4 z-50 flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';
        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg transition-all ${
              isError
                ? 'bg-white dark:bg-slate-900 border-red-200 dark:border-red-900/60 text-slate-900 dark:text-slate-100'
                : isSuccess
                ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/60 text-slate-900 dark:text-slate-100'
                : 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/60 text-slate-900 dark:text-slate-100'
            }`}
          >
            {isError ? (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                {toast.title}
              </p>
              {toast.message && (
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
