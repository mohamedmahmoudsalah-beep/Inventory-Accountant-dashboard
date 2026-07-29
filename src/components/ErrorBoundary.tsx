import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render-time errors anywhere below it so a bug in one widget/panel
 *  doesn't blank out the entire app to a white screen with no explanation.
 *  Shows a clear "something went wrong" screen with a reload button instead. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Unhandled error caught by ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-svh w-full flex items-center justify-center bg-[var(--bg)] text-[var(--text)] p-6">
          <div className="max-w-md text-center space-y-4">
            <AlertTriangle size={40} className="mx-auto text-[var(--bad)]" />
            <h1 className="text-lg font-semibold text-[var(--text-h)]">Something went wrong</h1>
            <p className="text-sm text-[var(--text-dim)]">
              The app hit an unexpected error and had to stop. Your data is safe — reloading the page usually fixes this.
              If it keeps happening, open the browser console (F12) for the exact error.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
