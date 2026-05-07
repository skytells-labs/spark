"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const [html, setHtml] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function highlight() {
      const { codeToHtml } = await import("shiki");
      const highlighted = await codeToHtml(code, {
        lang: normalizeLanguage(language),
        theme: "github-dark",
      });

      if (!cancelled) {
        setHtml(highlighted);
      }
    }

    setHtml(null);
    void highlight().catch(() => {
      if (!cancelled) {
        setHtml(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  return (
    <div className="relative h-full overflow-hidden bg-[#080808]">
      <div className="flex h-9 items-center justify-between border-b border-white/10 px-3 text-xs text-white/48">
        <span className="mono uppercase">{language}</span>
        <button
          type="button"
          className="rounded-md p-1.5 transition hover:bg-white/10 hover:text-white"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          aria-label="Copy code"
          title="Copy code"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <div className="h-[calc(100%-36px)] overflow-auto">
        {html ? (
          <div
            className="[&>pre]:!m-0 [&>pre]:!min-h-full [&>pre]:!bg-[#080808] [&>pre]:!p-5 [&>pre]:!text-[13px] [&>pre]:!leading-6"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="mono min-h-full overflow-auto p-5 text-[13px] leading-6 text-white/82">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

function normalizeLanguage(language: string) {
  if (language === "tsx" || language === "jsx") return language;
  if (language === "js") return "javascript";
  if (language === "ts") return "typescript";
  if (language === "md") return "markdown";
  return language || "text";
}
