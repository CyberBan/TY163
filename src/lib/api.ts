import { supabase } from "./supabase";
import type { ScheduleEvent, Homework, SyncState, Profile, SlotsState, CandlePrayer, SlotReaction } from "./types";

export async function fetchScheduleEvents(): Promise<ScheduleEvent[]> {
  const { data, error } = await supabase
    .from("schedule_events")
    .select("*")
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchSyncState(): Promise<SyncState | null> {
  const { data, error } = await supabase
    .from("schedule_sync")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function syncSchedule(): Promise<{ synced: boolean; changes: boolean; message?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const url = `${supabaseUrl}/functions/v1/sync-schedule`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Sync failed (${response.status})`);
  }

  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result;
}

export async function fetchHomework(): Promise<Homework[]> {
  const { data, error } = await supabase
    .from("homework")
    .select("*")
    .order("completed", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addHomework(
  subject: string,
  text: string,
  dueDate: string | null
): Promise<Homework> {
  const { data, error } = await supabase
    .from("homework")
    .insert({ subject, text, due_date: dueDate })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleHomework(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from("homework")
    .update({ completed })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteHomework(id: string): Promise<void> {
  const { error } = await supabase
    .from("homework")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function clearChangeFlags(): Promise<void> {
  const { error: eventsError } = await supabase
    .from("schedule_events")
    .update({ changed: false })
    .eq("changed", true);

  if (eventsError) throw eventsError;

  const { error: syncError } = await supabase
    .from("schedule_sync")
    .update({ changes_detected: false, changed_uids: [] })
    .eq("id", 1);

  if (syncError) throw syncError;
}

// --- Profiles ---

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProfile(displayName: string, avatarEmoji: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .insert({ display_name: displayName, avatar_emoji: avatarEmoji })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfileStats(
  maxBalance: number,
  totalWon: number,
  spins: number
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ max_balance: maxBalance, total_won: totalWon, spins })
    .eq("id", (await supabase.auth.getUser()).data.user?.id);
  if (error) throw error;
}

export async function fetchRating(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("max_balance", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

// --- Slots state ---

export async function fetchSlotsState(): Promise<SlotsState | null> {
  const { data, error } = await supabase
    .from("slots_state")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertSlotsState(
  balance: number,
  bet: number,
  history: { win: number; symbols: string }[]
): Promise<void> {
  const existing = await fetchSlotsState();
  if (existing) {
    const { error } = await supabase
      .from("slots_state")
      .update({ balance, bet, history, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("slots_state")
      .insert({ balance, bet, history });
    if (error) throw error;
  }
}

// --- Candle prayers ---

export async function fetchCandlePrayers(): Promise<CandlePrayer[]> {
  const { data, error } = await supabase
    .from("candle_prayers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export async function addCandlePrayer(subject: string, wish: string): Promise<CandlePrayer> {
  const { data, error } = await supabase
    .from("candle_prayers")
    .insert({ subject, wish })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Reactions ---

export async function fetchReactions(): Promise<SlotReaction[]> {
  const { data, error } = await supabase
    .from("slot_reactions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function toggleReaction(
  targetUserId: string,
  emoji: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("slot_reactions")
    .select("id")
    .eq("target_user_id", targetUserId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("slot_reactions")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("slot_reactions")
      .insert({ target_user_id: targetUserId, emoji });
    if (error) throw error;
  }
}
