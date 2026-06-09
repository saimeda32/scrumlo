import { useEffect, useState } from "react";

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
  const [busy, setBusy] = useState<null | "png" | "pdf">(null);

  // Escape closes the dialog (keyboard parity with the backdrop/✕).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Render the live board to an image, entirely in the browser (nothing sent).
  async function captureBoard(): Promise<{ dataUrl: string; w: number; h: number } | null> {
    // Prefer the full retro canvas (the whole wall) over the clipped viewport.
    const canvas = document.getElementById("scrumlo-canvas");
    const node = canvas ?? document.getElementById("scrumlo-board");
    if (!node) return null;
    const { toPng } = await import("html-to-image"); // lazy · keep it out of the initial bundle
    const dark = document.documentElement.classList.contains("dark");
    const opts: Record<string, unknown> = {
      pixelRatio: 2,
      backgroundColor: dark ? "#0a0a0f" : "#fafafb",
      cacheBust: true,
    };
    if (canvas) {
      // Capture the whole board unscaled, not just the zoomed viewport slice.
      opts.width = (node as HTMLElement).offsetWidth;
      opts.height = (node as HTMLElement).offsetHeight;
      opts.style = { transform: "none" };
    }
    const dataUrl = await toPng(node, opts);
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    return { dataUrl, w: img.naturalWidth, h: img.naturalHeight };
  }

  async function downloadImage() {
    setBusy("png");
    try {
      const cap = await captureBoard();
      if (!cap) return;
      const a = document.createElement("a");
      a.href = cap.dataUrl;
      a.download = `scrumlo-${room}.png`;
      a.click();
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    setBusy("pdf");
    try {
      const cap = await captureBoard();
      if (!cap) return;
      const { jsPDF } = await import("jspdf"); // lazy
      const pdf = new jsPDF({
        orientation: cap.w >= cap.h ? "landscape" : "portrait",
        unit: "px",
        format: [cap.w, cap.h],
      });
      pdf.addImage(cap.dataUrl, "PNG", 0, 0, cap.w, cap.h);
      pdf.save(`scrumlo-${room}.pdf`);
    } finally {
      setBusy(null);
    }
  }

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
    a.download = `scrumlo-${room}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 dark:bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label="Export session"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-xl dark:border dark:border-white/10 dark:bg-[#14141b]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Take the session with you</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          The room forgets when you leave · paste this into Slack, Jira, or a doc to keep what
          matters. Nothing is sent anywhere; this is built in your browser.
        </p>
        <textarea
          readOnly
          value={markdown}
          className="mb-4 min-h-[220px] flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700 dark:border-white/10 dark:bg-black/30 dark:text-slate-300"
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="flex-1 rounded-xl bg-iris-600 px-4 py-2 text-sm font-semibold text-white hover:bg-iris-500"
          >
            {copied ? "Copied ✓" : "Copy Markdown"}
          </button>
          <button
            onClick={download}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
          >
            Download .md
          </button>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-white/10">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Or grab a picture of the board, exactly as it looks now · so everyone keeps the same view.
          </p>
          <div className="flex gap-2">
            <button
              onClick={downloadImage}
              disabled={busy !== null}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
            >
              {busy === "png" ? "Rendering…" : "🖼 Board image (PNG)"}
            </button>
            <button
              onClick={downloadPdf}
              disabled={busy !== null}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
            >
              {busy === "pdf" ? "Rendering…" : "📄 Board PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
