import { Component, type ReactNode } from "react";

/**
 * Last-resort guard so a render error doesn't leave a blank, frozen page (for an
 * ephemeral tool, a white screen means the session is just gone). Shows a calm
 * fallback with a reload, instead of nothing.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Scrumlo render error", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-6 text-center dark:bg-[#0a0a0f]">
        <div className="max-w-sm">
          <div className="text-4xl">😵‍💫</div>
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Something glitched</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            The page hit an unexpected error. A refresh usually sorts it out, and rooms are ephemeral
            so nothing was stored either way.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-iris-600 px-5 py-2.5 font-semibold text-white shadow-soft transition hover:bg-iris-500"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
