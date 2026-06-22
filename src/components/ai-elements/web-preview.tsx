"use client";

import { memo } from "react";

export const WebPreview = memo(function WebPreview({ html }: { html: string }) {
  return (
    <iframe
      title="Artifact web preview"
      sandbox="allow-scripts"
      loading="lazy"
      srcDoc={html}
      className="h-full w-full border-0 bg-white"
    />
  );
});
