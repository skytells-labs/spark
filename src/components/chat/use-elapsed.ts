"use client";

import { useEffect, useState } from "react";

/** Tracks elapsed seconds since `startedAt`, freezing when `finishedAt` is set. */
export function useElapsed(startedAt?: number, finishedAt?: number) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    if (finishedAt) {
      setElapsed(Math.max(0, Math.round((finishedAt - startedAt) / 1000)));
      return;
    }

    const updateElapsed = () => {
      setElapsed(Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
    };

    updateElapsed();
    const id = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, finishedAt]);

  return elapsed;
}
