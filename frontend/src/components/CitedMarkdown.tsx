"use client";

import ReactMarkdown from "react-markdown";
import { useMission } from "@/lib/mission";

const CITE = /\[([A-Za-z0-9][A-Za-z0-9 .:_/\-]{0,60}?)\](?!\()/g;

/** Turns [BASS-II] / [doc:psi/x.pdf] markers into interactive citation chips. */
export function CitedMarkdown({ text, valid, streaming }: { text: string; valid?: Set<string>; streaming?: boolean }) {
  const { openInvestigation, dataset } = useMission();
  const known = new Set(dataset?.investigations.map((i) => i.id));
  const md = text.replace(CITE, (_, inner: string) =>
    inner.split(/[,;]\s*/).map((p) => `[${p.trim()}](#cite=${encodeURIComponent(p.trim())})`).join(" "));

  return (
    <div className={`prose-brief ${streaming ? "caret" : ""}`}>
      <ReactMarkdown
        components={{
          a: ({ href, children }) => {
            if (!href?.startsWith("#cite=")) return <a href={href} target="_blank" rel="noreferrer" className="text-ox underline">{children}</a>;
            const id = decodeURIComponent(href.slice(6));
            const isDoc = id.startsWith("doc:");
            const ok = isDoc || known.has(id);
            const verified = valid ? valid.has(id) : ok;
            return (
              <button type="button" onClick={() => !isDoc && ok && openInvestigation(id)}
                title={isDoc ? `Source document: ${id.slice(4)}` : ok ? `Open ${id} dossier` : "Citation not found in the evidence packet"}
                className={`mx-0.5 inline-flex translate-y-[-1px] items-center rounded-md border px-1.5 py-[1px] font-mono text-[10.5px] transition-colors ${
                  !verified ? "border-rose-400/50 bg-rose-500/10 text-rose-200 line-through"
                  : isDoc ? "border-violet-400/40 bg-violet-400/10 text-violet-200"
                  : "border-ox/40 bg-ox/10 text-[#9BEBFF] hover:bg-ox/25"}`}>
                {isDoc ? `📄 ${id.slice(4).split("/").pop()}` : id}
              </button>
            );
          },
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}
