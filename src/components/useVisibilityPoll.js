"use client";

import { useEffect, useRef } from "react";

const POLL_MS = 15_000;
const BACKOFF_MS = 60_000;
const BACKOFF_AFTER = 3; // consecutive errors
const MIN_GAP_MS = 1_000; // focus + visibilitychange fire together on return

/**
 * The one polling rule (off-site pages, the bell): run `task` every 15 s
 * while the tab is visible; nothing while it is hidden; once immediately when
 * it becomes visible again or the window regains focus; every 60 s after 3
 * errors in a row; never again once `task` returns "stop" (401 / 403 / 404).
 * `task` resolves to "ok" | "error" | "stop". `runNow` (returned ref) runs it
 * at once, e.g. after the person's own action.
 */
export default function useVisibilityPoll(task, { enabled = true, interval = POLL_MS } = {}) {
  const taskRef = useRef(task);
  taskRef.current = task;
  const runNow = useRef(() => {});

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    let errors = 0;
    let stopped = false;
    let running = false;
    let lastRun = 0;

    const schedule = () => {
      clearTimeout(timer);
      if (stopped || document.hidden) return; // resumes on visibilitychange
      timer = setTimeout(run, errors >= BACKOFF_AFTER ? BACKOFF_MS : interval);
    };
    const run = async () => {
      if (stopped || running || document.hidden) return schedule();
      running = true;
      lastRun = Date.now();
      let outcome = "error";
      try {
        outcome = await taskRef.current();
      } catch {
        outcome = "error";
      }
      running = false;
      if (outcome === "stop") {
        stopped = true;
        clearTimeout(timer);
        return undefined;
      }
      errors = outcome === "error" ? errors + 1 : 0;
      return schedule();
    };
    const onReturn = () => {
      if (document.hidden) {
        clearTimeout(timer);
        return;
      }
      if (Date.now() - lastRun < MIN_GAP_MS) return schedule();
      run();
    };

    runNow.current = run;
    schedule();
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      runNow.current = () => {};
    };
  }, [enabled, interval]);

  return runNow;
}

/**
 * Watch a `{ version }` endpoint: `known` is the version of the data on screen
 * (from the last load); `onChange(version)` is called when the server's
 * differs. 401 / 403 / 404 stop the watch.
 */
export function useVersionWatch(url, known, onChange, { enabled = true } = {}) {
  const knownRef = useRef(known);
  knownRef.current = known;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  return useVisibilityPoll(
    async () => {
      const res = await fetch(url, { cache: "no-store" });
      if ([401, 403, 404].includes(res.status)) return "stop";
      if (!res.ok) return "error";
      const { version } = await res.json();
      if (version && knownRef.current && version !== knownRef.current) onChangeRef.current(version);
      return "ok";
    },
    { enabled: enabled && !!url && !!known }
  );
}
