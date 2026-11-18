import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { ApiError } from "./api";

export function useRefreshOnVisible(refresh: () => void, enabled = true) {
  const onVisible = useEffectEvent(refresh);
  useEffect(() => {
    if (!enabled) return;
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") onVisible();
    }
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () =>
      document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [enabled]);
}

export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  { refreshOnVisible = false }: { refreshOnVisible?: boolean } = {},
) {
  const [result, setResult] = useState<{
    load: typeof load;
    revision: number;
    data: T | null;
    error: unknown;
    updatedAt: string | null;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({
            load,
            revision,
            data,
            error: null,
            updatedAt: new Date().toISOString(),
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult((previous) => {
            const keepPrevious =
              previous?.load === load &&
              !(
                error instanceof ApiError &&
                [401, 403, 404].includes(error.status)
              );
            return {
              load,
              revision,
              data: keepPrevious ? previous.data : null,
              error,
              updatedAt: keepPrevious ? previous.updatedAt : null,
            };
          });
      });
    return () => controller.abort();
  }, [load, revision]);
  const current = result?.load === load && result.revision === revision;
  useRefreshOnVisible(reload, refreshOnVisible && current);
  return {
    data: result?.load === load ? result.data : null,
    error: current ? result.error : null,
    loading: !current,
    reload,
    updatedAt: result?.load === load ? result.updatedAt : null,
  };
}

export function useBeforeUnload(dirty: boolean) {
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    if (dirty) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}
