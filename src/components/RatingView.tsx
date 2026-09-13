import { useState, useEffect } from "react";
import { Trophy, Crown, Medal, Flame, Loader2 } from "lucide-react";
import { fetchRating, fetchReactions, toggleReaction } from "@/lib/api";
import type { Profile, SlotReaction } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const REACTION_EMOJIS = ["🔥", "💰", "😂", "🤝", "💀"];

export default function RatingView() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reactions, setReactions] = useState<SlotReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  async function load() {
    try {
      setLoading(true);
      const [p, r] = await Promise.all([fetchRating(), fetchReactions()]);
      setProfiles(p);
      setReactions(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки рейтинга");
    } finally {
      setLoading(false);
    }
  }

  async function handleReact(targetUserId: string, emoji: string) {
    if (targetUserId === currentUserId) return;
    try {
      await toggleReaction(targetUserId, emoji);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  function getReactionCount(targetUserId: string, emoji: string): number {
    return reactions.filter((r) => r.target_user_id === targetUserId && r.emoji === emoji).length;
  }

  function hasReacted(targetUserId: string, emoji: string): boolean {
    return reactions.some(
      (r) =>
        r.target_user_id === targetUserId &&
        r.emoji === emoji &&
        r.reactor_user_id === currentUserId
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="w-5 h-5 text-amber-500" />
        <h3 className="text-sm font-bold text-gray-800">Рейтинг богачей</h3>
      </div>

      {profiles.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Пока никого нет. Крути слоты!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {profiles.map((p, i) => {
            const isTop3 = i < 3;
            const isMe = p.id === currentUserId;
            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl shadow-sm border p-4 transition-all ${
                  isTop3 ? "border-amber-200" : "border-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 text-center">
                    {i === 0 ? (
                      <Crown className="w-6 h-6 text-amber-500 mx-auto" />
                    ) : i === 1 ? (
                      <Medal className="w-6 h-6 text-gray-400 mx-auto" />
                    ) : i === 2 ? (
                      <Medal className="w-6 h-6 text-orange-700 mx-auto" />
                    ) : (
                      <span className="text-sm font-bold text-gray-400">{i + 1}</span>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl">
                    {p.avatar_emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {p.display_name}
                      {isMe && <span className="text-teal-600 text-xs ml-1">(ты)</span>}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.max_balance.toLocaleString("ru-RU")} ₽ · {p.spins} спинов
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-teal-600">
                      {p.max_balance.toLocaleString("ru-RU")}
                    </p>
                    <p className="text-xs text-gray-400">рекорд ₽</p>
                  </div>
                </div>

                {/* Reactions */}
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-50">
                  {REACTION_EMOJIS.map((emoji) => {
                    const count = getReactionCount(p.id, emoji);
                    const reacted = hasReacted(p.id, emoji);
                    const disabled = isMe;
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleReact(p.id, emoji)}
                        disabled={disabled}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                          reacted
                            ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                            : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                        } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        <span className="text-sm">{emoji}</span>
                        {count > 0 && <span>{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center px-4">
        Рейтинг обновляется по максимальному балансу. Жми на эмодзи, чтобы отреагировать!
      </p>
    </div>
  );
}
