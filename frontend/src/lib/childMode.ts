import { createContext, useContext } from "react";
import { useLocation } from "react-router-dom";

export const ParentAccessContext = createContext<((destination: string) => void) | null>(null);

export function useParentAccess() {
  const request = useContext(ParentAccessContext);
  if (!request) throw new Error("Missing child layout");
  return request;
}

export function childProfilePath(pathname: string) {
  return pathname.match(/^\/family\/children\/[^/]+/)?.[0] ?? null;
}

export function readChildModeProfile(accountId: string) {
  try {
    const profile = sessionStorage.getItem(`tinyclass:child-mode:${accountId}`);
    return profile && childProfilePath(profile) === profile ? profile : null;
  } catch {
    return null;
  }
}

export function saveChildModeProfile(accountId: string, profile: string | null) {
  try {
    const key = `tinyclass:child-mode:${accountId}`;
    if (profile) sessionStorage.setItem(key, profile);
    else sessionStorage.removeItem(key);
  } catch {
    // The layout keeps the session in memory when browser storage is unavailable.
  }
}

export function useChildMode() {
  const { pathname, search } = useLocation();
  if (/^\/family\/children\/[^/]+\/kids\/?$/.test(pathname)) return true;
  return (
    /^\/family\/children\/[^/]+\/(?:games|learning)(?:\/|$)/.test(pathname) &&
    new URLSearchParams(search).get("kid") === "1"
  );
}

export function childModeLink(path: string, enabled: boolean) {
  if (!enabled) return path;
  const [address, hash] = path.split("#", 2);
  const [pathname, query] = address.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("kid", "1");
  return `${pathname}?${params}${hash === undefined ? "" : `#${hash}`}`;
}
