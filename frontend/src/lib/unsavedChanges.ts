import { createContext, useContext, useEffect, useId } from "react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useBeforeUnload } from "./hooks";

export type Discard = () => void | Promise<void>;

export const UnsavedChangesContext = createContext<{
  request: (id: string, proceed: Discard) => void;
  dismiss: (id: string) => void;
} | null>(null);

export function useUnsavedChanges(dirty: boolean) {
  useBeforeUnload(dirty);
  const context = useContext(UnsavedChangesContext);
  const id = useId();
  useEffect(() => () => context?.dismiss(id), [context, id]);
  if (!context) throw new Error("Missing UnsavedChangesProvider");

  return (proceed: Discard) => {
    if (dirty) context.request(id, proceed);
    else void proceed();
  };
}

export function useUnsavedLink(
  dirty: boolean,
  confirmDiscard: (proceed: Discard) => void,
) {
  const navigate = useNavigate();
  return (event: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (
      !dirty ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey ||
      (event.currentTarget.target && event.currentTarget.target !== "_self")
    )
      return;

    event.preventDefault();
    confirmDiscard(() => navigate(to));
  };
}
