import { useState, useEffect } from "react";
import {
  CalendarDays,
  BookOpen,
  GraduationCap,
  Sparkles,
  Flame,
  Dices,
  Trophy,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchProfile } from "@/lib/api";
import type { Profile } from "@/lib/types";
import ScheduleView from "@/components/ScheduleView";
import HomeworkView from "@/components/HomeworkView";
import SlotsView from "@/components/SlotsView";
import CandleView from "@/components/CandleView";
import RatingView from "@/components/RatingView";
import AuthView from "@/components/AuthView";

type Tab = "schedule" | "homework" | "activity";
type ActivityMode = "candle" | "slots" | "rating";

export default function App() {
  const [session, setSession] = useState<null | { user: { id: string; email: string } }>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const [activityMode, setActivityMode] = useState<ActivityMode>("candle");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session as any);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess as any);
        if (!sess) {
          setProfile(null);
        }
      })();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfile(session.user.id).then(setProfile).catch(() => setProfile(null));
    } else {
      setProfile(null);
    }
  }, [session?.user?.id]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <GraduationCap className="w-8 h-8 text-teal-600 animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-gray-900 text-base leading-tight">Группа 163</h1>
            <p className="text-xs text-gray-400 leading-tight">
              {profile ? `${profile.avatar_emoji} ${profile.display_name}` : session.user.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Выйти"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-4 pb-24">
        {activeTab === "schedule" ? (
          <ScheduleView />
        ) : activeTab === "homework" ? (
          <HomeworkView />
        ) : (
          <>
            {/* Sub-tab switcher */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActivityMode("candle")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-medium text-xs transition-all ${
                  activityMode === "candle"
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200"
                    : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50"
                }`}
              >
                <Flame className="w-4 h-4" />
                Свечка
              </button>
              <button
                onClick={() => setActivityMode("slots")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-medium text-xs transition-all ${
                  activityMode === "slots"
                    ? "bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-md shadow-teal-200"
                    : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50"
                }`}
              >
                <Dices className="w-4 h-4" />
                Слоты
              </button>
              <button
                onClick={() => setActivityMode("rating")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-medium text-xs transition-all ${
                  activityMode === "rating"
                    ? "bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md shadow-amber-200"
                    : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50"
                }`}
              >
                <Trophy className="w-4 h-4" />
                Рейтинг
              </button>
            </div>

            {activityMode === "candle" ? (
              <CandleView />
            ) : activityMode === "slots" ? (
              <SlotsView />
            ) : (
              <RatingView />
            )}
          </>
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20">
        <div className="max-w-md mx-auto flex">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              activeTab === "schedule" ? "text-teal-600" : "text-gray-400"
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            <span className="text-xs font-medium">Расписание</span>
          </button>
          <button
            onClick={() => setActiveTab("homework")}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              activeTab === "homework" ? "text-teal-600" : "text-gray-400"
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-xs font-medium">Домашка</span>
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              activeTab === "activity" ? "text-teal-600" : "text-gray-400"
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-medium">Активность</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
