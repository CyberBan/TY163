/*
# Add user accounts, per-user data, rating, and reactions

## Overview
Adds multi-user support: registration, per-user homework/slots/candle data,
a leaderboard of richest slots players, and emoji reactions between users.

## 1. Modified Tables
- `homework` — added `user_id` column (uuid, defaults to auth.uid())
  - RLS changed from anon/public to authenticated owner-scoped
- `slots_state` — added `user_id` column, id now auto-increments via sequence
  - RLS changed from anon/public to authenticated owner-scoped
- `candle_prayers` — added `user_id` column
  - SELECT is public (everyone can see prayers), INSERT/DELETE owner-scoped

## 2. New Tables
- `profiles` — display name, avatar emoji, stats (max_balance, total_won, spins)
  - SELECT public, UPDATE owner-scoped
- `slot_reactions` — emoji reactions between users
  - SELECT public, INSERT requires reactor = auth.uid(), DELETE own

## 3. Security
- All tables have RLS enabled
- homework, slots_state: owner-scoped (auth.uid() = user_id)
- candle_prayers: SELECT public, INSERT/DELETE owner-scoped
- profiles: SELECT public, UPDATE owner-scoped
- slot_reactions: SELECT public, INSERT requires reactor = auth.uid(), DELETE own
- Old anon policies dropped and replaced with authenticated policies
*/

-- Add user_id to homework
ALTER TABLE homework ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS homework_user_id_idx ON homework(user_id);

-- Add user_id to slots_state, change id to auto-increment
CREATE SEQUENCE IF NOT EXISTS slots_state_id_seq;
ALTER TABLE slots_state ALTER COLUMN id SET DEFAULT nextval('slots_state_id_seq');
ALTER TABLE slots_state ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
CREATE UNIQUE INDEX IF NOT EXISTS slots_state_user_id_idx ON slots_state(user_id);

-- Add user_id to candle_prayers
ALTER TABLE candle_prayers ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS candle_prayers_user_id_idx ON candle_prayers(user_id);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_emoji text NOT NULL DEFAULT '🎓',
  max_balance int NOT NULL DEFAULT 1000,
  total_won int NOT NULL DEFAULT 0,
  spins int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_profiles" ON profiles;
DROP POLICY IF EXISTS "auth_select_profiles" ON profiles;
CREATE POLICY "auth_select_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_own_profile" ON profiles;
CREATE POLICY "auth_insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "auth_update_own_profile" ON profiles;
CREATE POLICY "auth_update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Create slot_reactions table
CREATE TABLE IF NOT EXISTS slot_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reactor_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_user_id, reactor_user_id, emoji)
);

ALTER TABLE slot_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_reactions" ON slot_reactions;
CREATE POLICY "auth_select_reactions" ON slot_reactions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_own_reaction" ON slot_reactions;
CREATE POLICY "auth_insert_own_reaction" ON slot_reactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reactor_user_id);

DROP POLICY IF EXISTS "auth_delete_own_reaction" ON slot_reactions;
CREATE POLICY "auth_delete_own_reaction" ON slot_reactions FOR DELETE
  TO authenticated USING (auth.uid() = reactor_user_id);

-- Update homework RLS: drop old anon policies, add authenticated owner-scoped
DROP POLICY IF EXISTS "anon_select_homework" ON homework;
DROP POLICY IF EXISTS "anon_insert_homework" ON homework;
DROP POLICY IF EXISTS "anon_update_homework" ON homework;
DROP POLICY IF EXISTS "anon_delete_homework" ON homework;

CREATE POLICY "auth_select_own_homework" ON homework FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "auth_insert_own_homework" ON homework FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_update_own_homework" ON homework FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_delete_own_homework" ON homework FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Update slots_state RLS: drop old anon policies, add authenticated owner-scoped
DROP POLICY IF EXISTS "anon_select_slots_state" ON slots_state;
DROP POLICY IF EXISTS "anon_insert_slots_state" ON slots_state;
DROP POLICY IF EXISTS "anon_update_slots_state" ON slots_state;
DROP POLICY IF EXISTS "anon_delete_slots_state" ON slots_state;

CREATE POLICY "auth_select_own_slots" ON slots_state FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "auth_insert_own_slots" ON slots_state FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_update_own_slots" ON slots_state FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_delete_own_slots" ON slots_state FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Update candle_prayers RLS: SELECT public, INSERT/DELETE owner-scoped
DROP POLICY IF EXISTS "anon_select_candle_prayers" ON candle_prayers;
DROP POLICY IF EXISTS "anon_insert_candle_prayers" ON candle_prayers;
DROP POLICY IF EXISTS "anon_delete_candle_prayers" ON candle_prayers;

CREATE POLICY "auth_select_candle_prayers" ON candle_prayers FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "auth_insert_own_prayer" ON candle_prayers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_delete_own_prayer" ON candle_prayers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
