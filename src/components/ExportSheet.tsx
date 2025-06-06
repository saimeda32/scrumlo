import { useState } from "react";

export function ExportSheet({
  room,
  markdown,
  onClose,
}: {
  room: string;
  markdown: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the textarea is selectable as a fallback
    }
  }

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ephem-${room}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Export session"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Take the session with you</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          The room forgets when you leave — paste this into Slack, Jira, or a doc to keep what
          matters. Nothing is sent anywhere; this is built in your browser.
        </p>
        <textarea
          readOnly
          value={markdown}
          className="mb-4 min-h-[220px] flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700"
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            {copied ? "Copied ✓" : "Copy Markdown"}
          </button>
          <button
            onClick={download}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Download .md
          </button>
        </div>
      </div>
    </div>
  );
}
