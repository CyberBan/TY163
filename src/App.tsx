import { useState, useEffect } from "react";
import {
  CalendarDays,
  BookOpen,
  GraduationCap,
  Flame,
  Dices,
  Trophy,
  LogOut,
  Cat,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { fetchProfile } from "@/lib/api";
import type { Profile } from "@/lib/types";

import ScheduleView from "@/components/ScheduleView";
import HomeworkView from "@/components/HomeworkView";
import SlotsView from "@/components/SlotsView";
import CandleView from "@/components/CandleView";
import RatingView from "@/components/RatingView";
import KittenView from "@/components/KittenView";
import AuthView from "@/components/AuthView";

type Tab =
  | "schedule"
  | "homework"
  | "activity";

type ActivityMode =
  | "kitten"
  | "candle"
  | "slots"
  | "rating";

export default function App() {
  const [session, setSession] = useState<
    null | {
      user: {
        id: string;
        email: string;
      };
    }
  >(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [activeTab, setActiveTab] =
    useState<Tab>("schedule");

  const [activityMode, setActivityMode] =
    useState<ActivityMode>("kitten");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session as any);
      setAuthLoading(false);
    });

    const {
      data: listener,
    } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        (async () => {
          setSession(sess as any);

          if (!sess) {
            setProfile(null);
          }
        })();
      }
    );

    return () =>
      listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfile(session.user.id)
        .then(setProfile)
        .catch(() => setProfile(null));
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

      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">

          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 text-base leading-tight">
              Группа 163
            </h1>

            <p className="text-xs text-gray-400 leading-tight truncate">
              {profile
                ? `${profile.avatar_emoji} ${profile.display_name}`
                : session.user.email}
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>
      </header>


      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4 pb-24">

        {activeTab === "schedule" && (
          <ScheduleView />
        )}

        {activeTab === "homework" && (
          <HomeworkView />
        )}

        {activeTab === "activity" && (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">

              <button
                onClick={() =>
                  setActivityMode("kitten")
                }
                className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activityMode === "kitten"
                    ? "bg-teal-600 text-white"
                    : "bg-white text-gray-600 border border-gray-100"
                }`}
              >
                <Cat className="w-4 h-4" />
                Котик
              </button>

              <button
                onClick={() =>
                  setActivityMode("candle")
                }
                className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activityMode === "candle"
                    ? "bg-teal-600 text-white"
                    : "bg-white text-gray-600 border border-gray-100"
                }`}
              >
                <Flame className="w-4 h-4" />
                Свечка
              </button>

              <button
                onClick={() =>
                  setActivityMode("slots")
                }
                className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activityMode === "slots"
                    ? "bg-teal-600 text-white"
                    : "bg-white text-gray-600 border border-gray-100"
                }`}
              >
                <Dices className="w-4 h-4" />
                Слоты
              </button>

              <button
                onClick={() =>
                  setActivityMode("rating")
                }
                className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activityMode === "rating"
                    ? "bg-teal-600 text-white"
                    : "bg-white text-gray-600 border border-gray-100"
                }`}
              >
                <Trophy className="w-4 h-4" />
                Рейтинг
              </button>

            </div>


            {activityMode === "kitten" && (
              <KittenView />
            )}

            {activityMode === "candle" && (
              <CandleView />
            )}

            {activityMode === "slots" && (
              <SlotsView />
            )}

            {activityMode === "rating" && (
              <RatingView />
            )}
          </>
        )}

      </main>


      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20">
        <div className="max-w-md mx-auto grid grid-cols-3">

          <button
            onClick={() =>
              setActiveTab("schedule")
            }
            className={`py-3 flex flex-col items-center gap-1 text-xs font-medium ${
              activeTab === "schedule"
                ? "text-teal-600"
                : "text-gray-400"
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            Расписание
          </button>

          <button
            onClick={() =>
              setActiveTab("homework")
            }
            className={`py-3 flex flex-col items-center gap-1 text-xs font-medium ${
              activeTab === "homework"
                ? "text-teal-600"
                : "text-gray-400"
            }`}
          >
            <BookOpen className="w-5 h-5" />
            ДЗ
          </button>

          <button
            onClick={() =>
              setActiveTab("activity")
            }
            className={`py-3 flex flex-col items-center gap-1 text-xs font-medium ${
              activeTab === "activity"
                ? "text-teal-600"
                : "text-gray-400"
            }`}
          >
            <Cat className="w-5 h-5" />
            Активности
          </button>

        </div>
      </nav>

    </div>
  );
}
