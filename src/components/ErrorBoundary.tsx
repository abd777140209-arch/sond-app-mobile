/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Smartphone } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export interface ErrorBoundary extends React.Component<Props, State> {}

export class ErrorBoundary extends (React.Component as any) {
  state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught in Sanad ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div 
          className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans"
          style={{ direction: 'rtl' }}
        >
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-extrabold flex items-center justify-center gap-2">
                <Smartphone className="w-6 h-6 text-amber-400" />
                <span>تطبيق سند للصيانة</span>
              </h1>
              <p className="text-xs text-slate-400">
                حدث استثناء غير متوقع. البيانات المخزنة محلياً (أوفلاين) بأمان التام ولم تفقد.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-rose-300 text-right overflow-x-auto max-h-32">
                {this.state.error.message || 'خطأ غير معرف في الواجهة'}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-98"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة تشغيل وتنشيط التطبيق</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
