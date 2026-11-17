import React from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

interface NoticeErrorBoundaryProps {
  resetKey: string;
  onBack: () => void;
  onRetry?: () => void;
  children: React.ReactNode;
}

interface NoticeErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class NoticeErrorBoundary extends React.Component<
  NoticeErrorBoundaryProps,
  NoticeErrorBoundaryState
> {
  constructor(props: NoticeErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): NoticeErrorBoundaryState {
    const rawMsg = error instanceof Error ? error.message : String(error || 'Unknown error');
    return { hasError: true, errorMessage: rawMsg };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    console.error('Notice detail error boundary caught error:', error, errorInfo);
  }

  componentDidUpdate(prevProps: NoticeErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: null });
    this.props.onRetry?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Notice load nahi hua
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Is notice ko dikhate waqt koi takneeki samasya aayi. Aap wapas notice list par ja
                sakte hain ya dobara koshish kar sakte hain.
              </p>
              {this.state.errorMessage && (
                <p className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-3.5 py-2.5 text-xs font-mono text-red-700 dark:text-red-300 break-words">
                  {this.state.errorMessage}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 px-4 text-xs font-semibold text-white cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Dobara Koshish Karein</span>
                </button>
                <button
                  type="button"
                  onClick={this.props.onBack}
                  className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Wapas Notice List Par Jaayein</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
