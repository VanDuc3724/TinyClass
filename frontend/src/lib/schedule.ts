import { api } from "./api";
import { businessToday } from "./format";

export const weekdays = [
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
  "Chủ nhật",
];
export interface CalendarClass {
  id: string;
  name: string;
  status: string;
  location?: string | null;
}
export interface TeachingSession {
  id: string;
  classId: string;
  className: string;
  classStatus?: string;
  startsAt: string;
  endsAt: string;
  title: string;
  location: string | null;
  status: string;
  cancellationReason: string | null;
  lessonPlan?: string | null;
  scheduleRuleId?: string | null;
  occurrenceWeek?: string | null;
  isManualOverride?: boolean;
  rosterCreatedAt?: string | null;
  version?: number;
  canEdit?: boolean;
  canCancel?: boolean;
}
export interface ScheduleRule {
  id: string;
  classId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  location: string | null;
  isActive: boolean;
  version: number;
}
export interface SchedulePlan {
  preview: boolean;
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  candidates: {
    action: string;
    title: string;
    className: string;
    startsAt: string;
    endsAt: string;
  }[];
  conflicts: {
    candidateTitle: string;
    candidateStartsAt: string;
    otherTitle: string;
    otherClassName: string;
    otherStartsAt: string;
    otherEndsAt: string;
  }[];
  conflictCount: number;
  conflictKey: string;
  session?: TeachingSession;
  rule?: ScheduleRule;
}
export interface ScheduleHistory {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  changedFields: { before?: TeachingSession; after?: TeachingSession };
}
export function addDays(value: string, amount: number) {
  const day = new Date(`${value}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + amount);
  return day.toISOString().slice(0, 10);
}
export function weekStart(value: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : null;
  const valid =
    parsed &&
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value;
  const date = valid ? value : businessToday();
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}
export function businessLocal(instant: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const p = (key: string) => parts.find((part) => part.type === key)!.value;
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}
export function localInstant(value: string) {
  return new Date(`${value}:00+07:00`).toISOString();
}
export function sessionHours(
  session: Pick<TeachingSession, "startsAt" | "endsAt">,
) {
  const start = businessLocal(session.startsAt),
    end = businessLocal(session.endsAt);
  return `${start.slice(11)} – ${start.slice(0, 10) === end.slice(0, 10) ? "" : end.slice(8, 10) + "/" + end.slice(5, 7) + " · "}${end.slice(11)}`;
}
export async function scheduleClasses(path: string, signal: AbortSignal) {
  const values: CalendarClass[] = [];
  for (let page = 0; ; page++) {
    const result = await api.list<CalendarClass>(
      `${path}?page=${page}&size=100`,
      signal,
    );
    values.push(...result.data);
    if (page + 1 >= result.meta.totalPages) return values;
  }
}
