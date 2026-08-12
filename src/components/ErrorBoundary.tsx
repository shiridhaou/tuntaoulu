import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional label to identify which boundary tripped (logged to console). */
  label?: string;
  /** Optional render override. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Local error boundary so a crash inside one panel (e.g. the Chief Dashboard)
 * does not bubble up to the router's global "Something went wrong" screen and
 * lock the whole app. Shows a tiny inline recovery card instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log so devs can see the exact offending variable / component.
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#050505] text-white">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>
          <h2 className="text-lg font-heading font-black mb-1">حدث خطأ في اللوحة</h2>
          <p className="text-xs text-white/60 font-body mb-4">
            تم عزل الخطأ — يمكنك المحاولة مجدداً دون فقدان الجلسة.
          </p>
          {error.message && (
            <pre className="max-h-32 overflow-auto rounded-md bg-black/40 p-3 text-left font-mono text-[10px] text-red-300 mb-4">
              {error.message}
            </pre>
          )}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={this.reset}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-white text-black text-xs font-heading font-bold tracking-wider hover:brightness-110"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              إعادة المحاولة
            </button>
            <button
              onClick={() => {
                try {
                  if (typeof window !== "undefined") {
                    window.localStorage.clear();
                    window.sessionStorage.clear();
                  }
                } catch { /* ignore */ }
                if (typeof window !== "undefined") window.location.href = "/";
              }}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-red-500 text-white text-xs font-heading font-bold tracking-wider hover:brightness-110"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              تحديث التطبيق
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-white/5 border border-white/10 text-white/80 text-xs font-heading font-bold tracking-wider hover:bg-white/10"
            >
              <Home className="h-3.5 w-3.5" />
              الرئيسية
            </a>
          </div>
        </div>
      </div>
    );
  }
}
