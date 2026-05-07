"use client";

export function WebPreview({ html }: { html: string }) {
  return (
    <iframe
      title="Artifact web preview"
      sandbox="allow-scripts"
      srcDoc={html}
      className="h-full w-full border-0 bg-white"
    />
  );
}
