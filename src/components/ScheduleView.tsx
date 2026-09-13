import { useState, useEffect, useMemo } from "react";
import {
  CalendarDays,
  MapPin,
  User,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  fetchScheduleEvents,
  fetchSyncState,
  syncSchedule,
  clearChangeFlags,
} from "@/lib/api";
import {
  type ScheduleEvent,
  type SyncState,
  DAY_NAMES,
  DAY_SHORT,
  LESSON_TYPE_LABELS,
  LESSON_TYPE_COLORS,
  getSemesterStart,
  shouldShowEvent,
} from "@/lib/types";

function formatTime(time: string): string {
  if (time.includes(":")) return time;
  return `${time.substring(0, 2)}:${time.substring(2)}`;
}

function getWeekDates(reference: Date): Date[] {
  const monday = new Date(reference);
  const day = monday.getDay() === 0 ? 7 : monday.getDay();
  monday.setDate(monday.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function ScheduleView() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(() => {
    const now = new Date();
    const day = now.getDay() === 0 ? 7 : now.getDay();
    return day;
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [eventsData, syncData] = await Promise.all([
        fetchScheduleEvents(),
        fetchSyncState(),
      ]);
      setEvents(eventsData);
      setSyncState(syncData);

      if (eventsData.length === 0) {
        await handleSync(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync(isInitial = false) {
    try {
      setSyncing(true);
      setSyncMessage(null);
      setError(null);
      const result = await syncSchedule();
      const [eventsData, syncData] = await Promise.all([
        fetchScheduleEvents(),
        fetchSyncState(),
      ]);
      setEvents(eventsData);
      setSyncState(syncData);

      if (result.changes) {
        setSyncMessage("Расписание обновлено — есть изменения!");
      } else if (!isInitial) {
        setSyncMessage("Расписание актуально, изменений нет");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDismissChanges() {
    await clearChangeFlags();
    setEvents((prev) => prev.map((e) => ({ ...e, changed: false })));
    setSyncState((prev) => (prev ? { ...prev, changes_detected: false, changed_uids: [] } : prev));
  }

  const semesterStart = useMemo(() => getSemesterStart(events), [events]);
  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, ScheduleEvent[]>();
    for (let i = 1; i <= 7; i++) map.set(i, []);

    for (const evt of events) {
      const list = map.get(evt.day_of_week);
      if (list) list.push(evt);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return map;
  }, [events]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isCurrentWeek = isSameDay(weekDates[0], getWeekDates(today)[0]);

  function shiftWeek(delta: number) {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + delta * 7);
    setCurrentWeek(newWeek);
  }

  function goToday() {
    const now = new Date();
    setCurrentWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = now.getDay() === 0 ? 7 : now.getDay();
    setSelectedDay(day);
  }

  const activeDay = selectedDay ?? (today.getDay() === 0 ? 7 : today.getDay());
  const activeDate = weekDates[activeDay - 1];
  const dayEvents = eventsByDay.get(activeDay) || [];
  const visibleDayEvents = semesterStart
    ? dayEvents.filter((e) => shouldShowEvent(e, "odd", semesterStart, activeDate))
    : [];

  const changedCount = events.filter((e) => e.changed).length;
  const lastSyncDate = syncState?.last_sync ? new Date(syncState.last_sync) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
          <p className="text-gray-500 text-sm">Загрузка расписания...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sync banner */}
      {syncState?.changes_detected && changedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              Расписание изменилось ({changedCount} {changedCount === 1 ? "изменение" : "изменений"})
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Изменённые пары выделены меткой «Изменено»
            </p>
          </div>
          <button
            onClick={handleDismissChanges}
            className="text-xs text-amber-700 font-medium underline flex-shrink-0"
          >
            Понятно
          </button>
        </div>
      )}

      {syncMessage && !syncState?.changes_detected && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-emerald-700">{syncMessage}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Week navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => shiftWeek(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center">
            <p className="font-semibold text-gray-900 text-sm">
              {weekDates[0].toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              {" — "}
              {weekDates[6].toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
            </p>
            {!isCurrentWeek && (
              <button onClick={goToday} className="text-xs text-teal-600 font-medium mt-0.5">
                К сегодняшней неделе
              </button>
            )}
          </div>
          <button
            onClick={() => shiftWeek(1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Day selector */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {weekDates.map((date, i) => {
            const dayNum = i + 1;
            const isToday = isSameDay(date, today);
            const isActive = dayNum === activeDay;
            const hasEvents = (eventsByDay.get(dayNum) || []).length > 0;
            return (
              <button
                key={dayNum}
                onClick={() => setSelectedDay(dayNum)}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-16 rounded-xl transition-all ${
                  isActive
                    ? "bg-teal-600 text-white shadow-md shadow-teal-200"
                    : isToday
                    ? "bg-teal-50 text-teal-700 border border-teal-200"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="text-[10px] font-medium">{DAY_SHORT[i]}</span>
                <span className="text-lg font-bold mt-0.5">{date.getDate()}</span>
                {hasEvents && (
                  <span className={`w-1 h-1 rounded-full mt-0.5 ${isActive ? "bg-white" : "bg-teal-400"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day schedule */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">
            {DAY_NAMES[activeDay - 1]}
          </h2>
          <span className="text-sm text-gray-400">
            {activeDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
          </span>
        </div>

        {visibleDayEvents.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Пар нет. Свободный день!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleDayEvents.map((evt) => {
              const typeKey = evt.lesson_type || "";
              const typeLabel = LESSON_TYPE_LABELS[typeKey] || typeKey;
              const typeColor = LESSON_TYPE_COLORS[typeKey] || "bg-gray-100 text-gray-600 border-gray-200";
              return (
                <div
                  key={evt.uid}
                  className={`bg-white rounded-2xl shadow-sm border p-4 transition-all ${
                    evt.changed ? "border-amber-300 ring-1 ring-amber-100" : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm leading-snug">
                        {evt.subject}
                      </h3>
                      {typeLabel && (
                        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${typeColor}`}>
                          {typeLabel}
                        </span>
                      )}
                    </div>
                    {evt.changed && (
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                        Изменено
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 mt-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {formatTime(evt.start_time)} — {formatTime(evt.end_time)}
                      </span>
                    </div>
                    {evt.location && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{evt.location}</span>
                      </div>
                    )}
                    {evt.teacher && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <User className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{evt.teacher}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sync button */}
      <div className="pt-2">
        <button
          onClick={() => handleSync()}
          disabled={syncing}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-teal-600 text-white rounded-xl font-medium text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Обновление..." : "Обновить расписание"}
        </button>
        {lastSyncDate && (
          <p className="text-center text-xs text-gray-400 mt-2">
            Последнее обновление: {lastSyncDate.toLocaleString("ru-RU", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
