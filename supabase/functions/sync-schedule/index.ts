import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ICS_URL = "https://spbti.ru/calendar/163.ics";

interface ParsedEvent {
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
}

function unfoldICS(icsText: string): string {
  // ICS line folding: continuation lines start with a space or tab.
  // Join them with the previous line (removing the leading space/tab).
  return icsText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function parseICS(icsText: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const unfolded = unfoldICS(icsText);
  const vevents = unfolded.split("BEGIN:VEVENT").slice(1);

  for (const block of vevents) {
    const endIdx = block.indexOf("END:VEVENT");
    const content = endIdx >= 0 ? block.substring(0, endIdx) : block;

    const get = (key: string): string | null => {
      const m = content.match(new RegExp(`${key}[^:]*:(.+)`));
      return m ? m[1].trim() : null;
    };

    const uid = get("UID");
    const summary = get("SUMMARY");
    const dtstart = get("DTSTART");
    const dtend = get("DTEND");
    const location = get("LOCATION");
    const description = get("DESCRIPTION");
    const rrule = get("RRULE");

    if (!uid || !summary || !dtstart || !dtend) continue;

    const summaryClean = summary.replace(/\\,/g, ",").trim();
    const parts = summaryClean.split(",");
    const subject = parts[0].trim();
    const lesson_type = parts[1] ? parts[1].trim() : null;

    const dtMatch = dtstart.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    if (!dtMatch) continue;
    const [, y, mo, d, h, mi] = dtMatch;
    const startDateStr = `${y}-${mo}-${d}`;
    const startTime = `${h}:${mi}`;

    const dtEndMatch = dtend.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    if (!dtEndMatch) continue;
    const endTime = `${dtEndMatch[4]}:${dtEndMatch[5]}`;

    const startDate = new Date(`${y}-${mo}-${d}T00:00:00Z`);
    const dayOfWeek = startDate.getUTCDay() === 0 ? 7 : startDate.getUTCDay();

    let intervalWeeks = 1;
    if (rrule) {
      const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
      if (intervalMatch) intervalWeeks = parseInt(intervalMatch[1]);
    }

    let untilDate: string | null = null;
    if (rrule) {
      const untilMatch = rrule.match(/UNTIL=(\d{8})/);
      if (untilMatch) untilDate = `${untilMatch[1].substring(0, 4)}-${untilMatch[1].substring(4, 6)}-${untilMatch[1].substring(6, 8)}`;
    }

    let teacher: string | null = null;
    if (description) {
      const teacherMatch = description.match(/Преподаватель:\s*(.+?)(?:\\n|$)/);
      if (teacherMatch) teacher = teacherMatch[1].replace(/\\n/g, "").trim();
    }

    const locationClean = location ? location.replace(/\\,/g, ",").replace(/\s+/g, " ").trim() : null;

    events.push({
      uid,
      summary: summaryClean,
      subject,
      lesson_type,
      location: locationClean,
      teacher,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      start_date: startDateStr,
      interval_weeks: intervalWeeks,
      until_date: untilDate,
    });
  }

  return events;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const icsResponse = await fetch(ICS_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!icsResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch ICS: ${icsResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const icsText = await icsResponse.text();
    const hash = await sha256(icsText);

    const { data: syncRow } = await supabase
      .from("schedule_sync")
      .select("ics_hash")
      .eq("id", 1)
      .maybeSingle();

    const isInitialSync = !syncRow || !syncRow.ics_hash;
    const noChanges = syncRow?.ics_hash === hash;

    if (noChanges && !isInitialSync) {
      await supabase
        .from("schedule_sync")
        .update({
          last_sync: new Date().toISOString(),
          changes_detected: false,
          changed_uids: [],
        })
        .eq("id", 1);

      return new Response(
        JSON.stringify({ synced: true, changes: false, message: "No changes detected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsedEvents = parseICS(icsText);
    const newUids = new Set(parsedEvents.map((e) => e.uid));

    const { data: existingEvents } = await supabase
      .from("schedule_events")
      .select("uid, summary, location, teacher, start_time, end_time, day_of_week, interval_weeks, start_date");

    const existingMap = new Map<string, any>();
    for (const e of existingEvents || []) {
      existingMap.set(e.uid, e);
    }

    const changedUids: string[] = [];
    const upsertRows: any[] = [];

    for (const evt of parsedEvents) {
      const existing = existingMap.get(evt.uid);
      const isChanged =
        !existing ||
        existing.summary !== evt.summary ||
        existing.location !== evt.location ||
        existing.teacher !== evt.teacher ||
        existing.start_time !== evt.start_time ||
        existing.end_time !== evt.end_time ||
        existing.day_of_week !== evt.day_of_week ||
        existing.interval_weeks !== evt.interval_weeks ||
        existing.start_date !== evt.start_date;

      if (isChanged) changedUids.push(evt.uid);

      upsertRows.push({
        ...evt,
        changed: isChanged,
        updated_at: new Date().toISOString(),
      });
    }

    const removedUids: string[] = [];
    for (const uid of existingMap.keys()) {
      if (!newUids.has(uid)) removedUids.push(uid);
    }

    if (upsertRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("schedule_events")
        .upsert(upsertRows, { onConflict: "uid" });
      if (upsertError) throw upsertError;
    }

    if (removedUids.length > 0) {
      await supabase.from("schedule_events").delete().in("uid", removedUids);
    }

    await supabase
      .from("schedule_sync")
      .upsert({
        id: 1,
        last_sync: new Date().toISOString(),
        ics_hash: hash,
        changes_detected: changedUids.length > 0 || removedUids.length > 0,
        changed_uids: [...changedUids, ...removedUids],
      });

    return new Response(
      JSON.stringify({
        synced: true,
        changes: changedUids.length > 0 || removedUids.length > 0,
        added_or_modified: changedUids.length,
        removed: removedUids.length,
        total_events: parsedEvents.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
