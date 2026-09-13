export interface ScheduleEvent {
  id: string;
  uid: string;
  summary: string;
  subject: string;
  lesson_type: string | null;
  location: string | null;
  teacher: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  start_date: string;
  interval_weeks: number;
  until_date: string | null;
  changed: boolean;
  updated_at: string;
}

export interface Homework {
  id: string;
  subject: string;
  text: string;
  due_date: string | null;
  completed: boolean;
  created_at: string;
  user_id: string;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_emoji: string;
  max_balance: number;
  total_won: number;
  spins: number;
  created_at: string;
}

export interface SlotsState {
  id: number;
  balance: number;
  bet: number;
  history: { win: number; symbols: string }[];
  updated_at: string;
  user_id: string;
}

export interface CandlePrayer {
  id: string;
  subject: string;
  wish: string;
  created_at: string;
  user_id: string;
}

export interface SlotReaction {
  id: string;
  target_user_id: string;
  reactor_user_id: string;
  emoji: string;
  created_at: string;
}

export interface SyncState {
  id: number;
  last_sync: string;
  ics_hash: string | null;
  changes_detected: boolean;
  changed_uids: string[];
}

export const DAY_NAMES = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

export const DAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const LESSON_TYPE_LABELS: Record<string, string> = {
  "лекц.": "Лекция",
  "практ.": "Практика",
  "лаб.": "Лабораторная",
  "лекц": "Лекция",
  "практ": "Практика",
  "лаб": "Лабораторная",
};

export const LESSON_TYPE_COLORS: Record<string, string> = {
  "лекц.": "bg-blue-100 text-blue-700 border-blue-200",
  "практ.": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "лаб.": "bg-amber-100 text-amber-700 border-amber-200",
  "лекц": "bg-blue-100 text-blue-700 border-blue-200",
  "практ": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "лаб": "bg-amber-100 text-amber-700 border-amber-200",
};

export function getWeekParity(date: Date): "odd" | "even" {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(diff / 7) + 1;
  return weekNum % 2 === 1 ? "odd" : "even";
}

function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - day + 1);
  return d;
}

export function getSemesterStart(events: ScheduleEvent[]): Date | null {
  if (events.length === 0) return null;
  const dates = events.map((e) => parseDateLocal(e.start_date).getTime());
  return new Date(Math.min(...dates));
}

export function shouldShowEvent(
  event: ScheduleEvent,
  _currentWeekParity: "odd" | "even",
  semesterStart: Date | null,
  targetDate: Date
): boolean {
  if (!semesterStart) return false;

  const eventStart = parseDateLocal(event.start_date);
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  if (target < eventStart) return false;

  if (event.until_date) {
    const until = parseDateLocal(event.until_date);
    if (target > until) return false;
  }

  if (event.interval_weeks === 1) return true;

  // Align to calendar weeks (Monday-based) to avoid off-by-one when
  // the semester start falls mid-week (e.g. Tuesday).
  const semesterMonday = getMondayOfWeek(semesterStart);
  const eventMonday = getMondayOfWeek(eventStart);
  const targetMonday = getMondayOfWeek(target);

  const eventWeekDiff = Math.round(
    (eventMonday.getTime() - semesterMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  const targetWeekDiff = Math.round(
    (targetMonday.getTime() - semesterMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  return (targetWeekDiff - eventWeekDiff) % 2 === 0;
}
