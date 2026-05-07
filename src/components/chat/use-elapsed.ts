"use client";

import { useEffect, useState } from "react";

export function useElapsed(startedAt?: number, finishedAt?: number) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    if (finishedAt) {
      setElapsed(Math.round((finishedAt - startedAt) / 1000));
      return;
    }

    setElapsed(Math.round((Date.now() - startedAt) / 1000));

    const id = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt) / 1000));
    }, 500);

    return () => window.clearInterval(id);
  }, [startedAt, finishedAt]);

  return elapsed;
}
