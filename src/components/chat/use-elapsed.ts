"use client";

import { useEffect, useState } from "react";

/** Tracks elapsed seconds since `startedAt`, freezing when `finishedAt` is set. */
export function useElapsed(startedAt?: number, finishedAt?: number) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    if (finishedAt) {
      setElapsed(Math.round((finishedAt - startedAt) / 1000));
      return;
    }
    setElapsed(Math.round((Date.now() - startedAt) / 1000));
    const id = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt) / 1000)),
      500,
    );
    return () => clearInterval(id);
  }, [startedAt, finishedAt]);

  return elapsed;
}
