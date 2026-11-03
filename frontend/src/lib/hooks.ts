import { useEffect, useState } from "react";
import { ApiError } from "./api";
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<{
    load: typeof load;
    revision: number;
    data: T | null;
    error: unknown;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ load, revision, data, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            load,
            revision,
            data:
              previous?.load === load &&
              !(
                error instanceof ApiError &&
                [401, 403, 404].includes(error.status)
              )
                ? previous.data
                : null,
            error,
          }));
      });
    return () => controller.abort();
  }, [load, revision]);
  const current = result?.load === load && result.revision === revision;
  return {
    data: result?.load === load ? result.data : null,
    error: current ? result.error : null,
    loading: !current,
    reload: () => setRevision((value) => value + 1),
  };
}
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    if (dirty) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return () =>
    !dirty || window.confirm("Bạn có thay đổi chưa lưu. Rời biểu mẫu này?");
}
