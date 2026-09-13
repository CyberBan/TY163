/*
# Create schedule and homework tables (single-tenant, no auth)

## Overview
This migration creates three tables for a university schedule app for group 163:
1. `schedule_events` — parsed ICS calendar events from spbti.ru
2. `schedule_sync` — tracks the last sync state and ICS content hash
3. `homework` — user's homework entries with completion status

## Tables

### schedule_events
Stores parsed ICS VEVENT entries. Each row is one recurring class session.
- `uid` — the ICS event UID (unique identifier from the university)
- `summary` — full summary string (e.g. "Общая и неорганическая химия, лекц.")
- `subject` — extracted subject name (e.g. "Общая и неорганическая химия")
- `lesson_type` — extracted type: "лекц", "практ", "лаб"
- `location` — classroom/building
- `teacher` — instructor name extracted from description
- `day_of_week` — 1=Monday ... 7=Sunday
- `start_time` / `end_time` — "HH:MM" format
- `start_date` — first occurrence date (determines biweekly parity)
- `interval_weeks` — 1 = every week, 2 = every other week
- `until_date` — semester end date
- `changed` — true if this event was added or modified in the latest sync
- `updated_at` — last modification timestamp

### schedule_sync
Single-row table tracking sync state.
- `id` — always 1 (singleton)
- `last_sync` — when the schedule was last fetched from spbti.ru
- `ics_hash` — SHA-256 hash of the raw ICS content (to detect changes)
- `changes_detected` — true if the latest sync found differences
- `changed_uids` — array of UIDs that were added or modified

### homework
User's homework entries.
- `subject` — which subject the homework is for
- `text` — the homework description
- `due_date` — optional deadline
- `completed` — whether it's done

## Security
- RLS enabled on all tables.
- All tables use `TO anon, authenticated` since this is a single-user no-auth app.
- `USING (true)` / `WITH CHECK (true)` is acceptable because the data is intentionally public/shared (no sign-in screen).
*/

-- schedule_events
CREATE TABLE IF NOT EXISTS schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid text UNIQUE NOT NULL,
  summary text NOT NULL,
  subject text NOT NULL,
  lesson_type text,
  location text,
  teacher text,
  day_of_week int NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  start_date date NOT NULL,
  interval_weeks int NOT NULL DEFAULT 1,
  until_date date,
  changed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_schedule_events" ON schedule_events;
CREATE POLICY "anon_select_schedule_events" ON schedule_events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_schedule_events" ON schedule_events;
CREATE POLICY "anon_insert_schedule_events" ON schedule_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_schedule_events" ON schedule_events;
CREATE POLICY "anon_update_schedule_events" ON schedule_events FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_schedule_events" ON schedule_events;
CREATE POLICY "anon_delete_schedule_events" ON schedule_events FOR DELETE
  TO anon, authenticated USING (true);

-- schedule_sync
CREATE TABLE IF NOT EXISTS schedule_sync (
  id int PRIMARY KEY DEFAULT 1,
  last_sync timestamptz NOT NULL DEFAULT now(),
  ics_hash text,
  changes_detected boolean NOT NULL DEFAULT false,
  changed_uids text[] NOT NULL DEFAULT '{}',
  CONSTRAINT singleton_check CHECK (id = 1)
);

INSERT INTO schedule_sync (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE schedule_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_schedule_sync" ON schedule_sync;
CREATE POLICY "anon_select_schedule_sync" ON schedule_sync FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_schedule_sync" ON schedule_sync;
CREATE POLICY "anon_update_schedule_sync" ON schedule_sync FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_schedule_sync" ON schedule_sync;
CREATE POLICY "anon_insert_schedule_sync" ON schedule_sync FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- homework
CREATE TABLE IF NOT EXISTS homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  text text NOT NULL,
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE homework ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_homework" ON homework;
CREATE POLICY "anon_select_homework" ON homework FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_homework" ON homework;
CREATE POLICY "anon_insert_homework" ON homework FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_homework" ON homework;
CREATE POLICY "anon_update_homework" ON homework FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_homework" ON homework;
CREATE POLICY "anon_delete_homework" ON homework FOR DELETE
  TO anon, authenticated USING (true);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_schedule_events_day ON schedule_events(day_of_week);
CREATE INDEX IF NOT EXISTS idx_homework_completed ON homework(completed);
CREATE INDEX IF NOT EXISTS idx_homework_due_date ON homework(due_date);
