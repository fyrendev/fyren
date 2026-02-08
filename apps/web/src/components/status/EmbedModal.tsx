"use client";

import { useState } from "react";
import { Code2, Check, Copy, X } from "lucide-react";

export function EmbedButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 brand-link">
        <Code2 className="w-4 h-4" />
        Embed
      </button>
      {open && <EmbedModal onClose={() => setOpen(false)} />}
    </>
  );
}

function EmbedModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [style, setStyle] = useState<"minimal" | "compact" | "full">("compact");

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const iframeCode = `<iframe src="${origin}/widget?theme=${theme}&style=${style}" style="width:100%;border:none;overflow:hidden" title="Status" loading="lazy"></iframe>
<script>
window.addEventListener("message",function(e){try{var d=JSON.parse(e.data);if(d.type==="fyren-resize")e.source&&(e.source.frameElement||document.querySelector('iframe[src*="/widget"]')).style.height=d.height+"px"}catch(x){}});
</script>`;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg theme-card p-6"
        style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Embed Status Widget</h3>
          <button onClick={onClose} className="theme-muted hover:opacity-70 transition-opacity">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm theme-muted mb-5">
          Add this status widget to your website to show your current system status.
        </p>

        {/* Options */}
        <div className="flex gap-4 mb-5">
          <div>
            <label className="block text-xs theme-muted mb-1.5">Theme</label>
            <div className="flex gap-1.5">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: theme === t ? "var(--brand-color)" : "var(--input-bg)",
                    color: theme === t ? "white" : "inherit",
                    border: `1px solid ${theme === t ? "var(--brand-color)" : "var(--input-border)"}`,
                  }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs theme-muted mb-1.5">Style</label>
            <div className="flex gap-1.5">
              {(["minimal", "compact", "full"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: style === s ? "var(--brand-color)" : "var(--input-bg)",
                    color: style === s ? "white" : "inherit",
                    border: `1px solid ${style === s ? "var(--brand-color)" : "var(--input-border)"}`,
                  }}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mb-5">
          <label className="block text-xs theme-muted mb-1.5">Preview</label>
          <div
            className="rounded-lg p-3 overflow-hidden"
            style={{
              backgroundColor: theme === "dark" ? "#1e293b" : "#ffffff",
            }}
          >
            {origin && (
              <iframe
                src={`${origin}/widget?theme=${theme}&style=${style}`}
                style={{
                  width: "100%",
                  height: style === "full" ? "200px" : "70px",
                  border: "none",
                  overflow: "hidden",
                  transition: "height 0.2s ease",
                }}
                title="Status Widget Preview"
                loading="lazy"
              />
            )}
          </div>
        </div>

        {/* Code */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs theme-muted">Embed Code</label>
            <button
              onClick={() => copy(iframeCode, "embed")}
              className="flex items-center gap-1 text-xs brand-link"
            >
              {copied === "embed" ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre
            className="text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all"
            style={{
              backgroundColor: "var(--input-bg)",
              border: "1px solid var(--input-border)",
            }}
          >
            {iframeCode}
          </pre>
        </div>
      </div>
    </div>
  );
}
