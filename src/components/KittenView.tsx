import { useEffect, useMemo, useState } from "react";
import { Heart, ShoppingBag, Utensils, Check, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";

type KittenState = {
  user_id: string;
  name: string;
  xp: number;
  level: number;
  hunger: number;
  last_fed_at: string | null;
  attended_events: string[];
  owned_costumes: string[];
  equipped_costume: string;
};

type ScheduleEvent = {
  id: string;
  subject: string;
  start_time: string;
  end_time: string;
};

type Costume = {
  id: string;
  name: string;
  emoji: string;
  price: number;
  requiredLevel: number;
};

const COSTUMES: Costume[] = [
  {
    id: "default",
    name: "Обычный",
    emoji: "",
    price: 0,
    requiredLevel: 1,
  },
  {
    id: "student",
    name: "Студент",
    emoji: "🎓",
    price: 300,
    requiredLevel: 1,
  },
  {
    id: "chemist",
    name: "Химик",
    emoji: "⚗️",
    price: 700,
    requiredLevel: 2,
  },
  {
    id: "lab",
    name: "Лаборант",
    emoji: "🥼",
    price: 1200,
    requiredLevel: 3,
  },
  {
    id: "scientist",
    name: "Учёный",
    emoji: "🧪",
    price: 2000,
    requiredLevel: 5,
  },
  {
    id: "ninja",
    name: "Ниндзя",
    emoji: "🥷",
    price: 3500,
    requiredLevel: 7,
  },
  {
    id: "king",
    name: "Король",
    emoji: "👑",
    price: 6000,
    requiredLevel: 10,
  },
];

const XP_PER_CLASS = 20;
const XP_PER_LEVEL = 100;
const FEED_PRICE = 25;

function getLevel(xp: number) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

function getCat(level: number) {
  if (level >= 10) return "😼";
  if (level >= 7) return "😺";
  if (level >= 5) return "😸";
  if (level >= 3) return "😻";
  if (level >= 2) return "🐱";
  return "🐈";
}

function isSameDay(a: string | null) {
  if (!a) return false;

  const date = new Date(a);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function KittenView() {
  const [kitten, setKitten] = useState<KittenState | null>(null);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [balance, setBalance] = useState(0);

  const [loading, setLoading] = useState(true);
  const [feeding, setFeeding] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [attending, setAttending] = useState<string | null>(null);

  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: kittenData, error: kittenError } =
        await supabase.rpc("get_or_create_kitten");

      if (kittenError) throw kittenError;

      setKitten({
        ...kittenData,
        attended_events: kittenData.attended_events || [],
        owned_costumes: kittenData.owned_costumes || ["default"],
      });

      const { data: slotsData } = await supabase
        .from("slots_state")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      setBalance(Number(slotsData?.balance || 0));

      const now = new Date();

      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: scheduleData, error: scheduleError } =
        await supabase
          .from("schedule_events")
          .select("id, subject, start_time, end_time")
          .gte("start_time", startOfDay.toISOString())
          .lte("start_time", endOfDay.toISOString())
          .order("start_time", { ascending: true });

      if (!scheduleError) {
        setEvents(scheduleData || []);
      }
    } catch (error) {
      console.error(error);
      setMessage("Не удалось загрузить котика");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function feed() {
    if (feeding) return;

    setFeeding(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc("feed_kitten");

      if (error) throw error;

      setKitten(data.kitten);
      setBalance(Number(data.balance));

      setMessage("Котик накормлен ❤️");
    } catch (error: any) {
      setMessage(error?.message || "Не удалось покормить котика");
    } finally {
      setFeeding(false);
    }
  }

  async function buyCostume(costume: Costume) {
    if (buying) return;

    setBuying(costume.id);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "buy_kitten_costume",
        {
          costume_id: costume.id,
          price: costume.price,
        }
      );

      if (error) throw error;

      setKitten(data.kitten);
      setBalance(Number(data.balance));

      setMessage(`Костюм «${costume.name}» куплен`);
    } catch (error: any) {
      setMessage(error?.message || "Не удалось купить костюм");
    } finally {
      setBuying(null);
    }
  }

  async function equipCostume(costumeId: string) {
    try {
      const { data, error } = await supabase.rpc(
        "equip_kitten_costume",
        {
          costume_id: costumeId,
        }
      );

      if (error) throw error;

      setKitten(data);
      setMessage("Костюм надет");
    } catch (error: any) {
      setMessage(error?.message || "Не удалось надеть костюм");
    }
  }

  async function attendClass(event: ScheduleEvent) {
    if (!kitten || attending) return;

    const now = Date.now();
    const start = new Date(event.start_time).getTime();
    const end = new Date(event.end_time).getTime();

    const fifteenMinutes = 15 * 60 * 1000;
    const thirtyMinutes = 30 * 60 * 1000;

    if (
      now < start - fifteenMinutes ||
      now > end + thirtyMinutes
    ) {
      setMessage(
        "Отметиться можно за 15 минут до пары и до 30 минут после неё"
      );
      return;
    }

    if (kitten.attended_events.includes(event.id)) {
      setMessage("Эта пара уже засчитана");
      return;
    }

    setAttending(event.id);
    setMessage("");

    try {
      const newXp = kitten.xp + XP_PER_CLASS;
      const newLevel = getLevel(newXp);

      const newAttended = [
        ...kitten.attended_events,
        event.id,
      ];

      const { data, error } = await supabase
        .from("kitten_state")
        .update({
          xp: newXp,
          level: newLevel,
          attended_events: newAttended,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", kitten.user_id)
        .select()
        .single();

      if (error) throw error;

      setKitten(data);

      setMessage(
        newLevel > kitten.level
          ? `🎉 Котик вырос до ${newLevel} уровня!`
          : `+${XP_PER_CLASS} XP за посещение`
      );
    } catch (error: any) {
      setMessage(error?.message || "Не удалось отметить посещение");
    } finally {
      setAttending(null);
    }
  }

  const hungerText = useMemo(() => {
    if (!kitten) return "";

    if (kitten.hunger >= 80) return "Котик сыт";
    if (kitten.hunger >= 50) return "Котик немного голоден";
    if (kitten.hunger >= 20) return "Котик сильно голоден";
    return "Котик очень голоден";
  }, [kitten]);

  if (loading || !kitten) {
    return (
      <div className="py-16 text-center text-gray-400">
        Загружаем котика...
      </div>
    );
  }

  const levelProgress = kitten.xp % XP_PER_LEVEL;

  return (
    <div className="space-y-4 pb-4">

      {/* КОТИК */}

      <section className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        <div className="p-6 text-center">

          <div className="text-8xl leading-none mb-3 select-none">
            {getCat(kitten.level)}
            {kitten.equipped_costume !== "default" && (
              <span className="text-5xl ml-[-20px]">
                {
                  COSTUMES.find(
                    (x) => x.id === kitten.equipped_costume
                  )?.emoji
                }
              </span>
            )}
          </div>

          <h2 className="text-xl font-bold text-gray-900">
            {kitten.name}
          </h2>

          <p className="text-sm text-gray-400 mt-1">
            Уровень {kitten.level}
          </p>

          {/* XP */}

          <div className="mt-5">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">
                Опыт
              </span>

              <span className="font-semibold text-gray-700">
                {levelProgress}/{XP_PER_LEVEL}
              </span>
            </div>

            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all"
                style={{
                  width: `${levelProgress}%`,
                }}
              />
            </div>
          </div>

          {/* Голод */}

          <div className="mt-5">
            <div className="flex justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-gray-400">
                <Heart className="w-3.5 h-3.5" />
                Сытость
              </span>

              <span className="font-semibold text-gray-700">
                {kitten.hunger}/100
              </span>
            </div>

            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-pink-400 rounded-full transition-all"
                style={{
                  width: `${kitten.hunger}%`,
                }}
              />
            </div>

            <p className="text-xs text-gray-400 mt-2">
              {hungerText}
            </p>
          </div>

          <button
            onClick={feed}
            disabled={
              feeding ||
              isSameDay(kitten.last_fed_at) ||
              balance < FEED_PRICE
            }
            className="w-full mt-5 py-3 rounded-2xl bg-orange-500 text-white font-semibold disabled:bg-gray-200 disabled:text-gray-400 transition"
          >
            <span className="flex items-center justify-center gap-2">
              <Utensils className="w-4 h-4" />

              {isSameDay(kitten.last_fed_at)
                ? "Сегодня уже покормлен"
                : `Покормить · ${FEED_PRICE} ₽`}
            </span>
          </button>

          <div className="mt-3 text-sm text-gray-400">
            Баланс:{" "}
            <span className="font-bold text-gray-700">
              {balance.toLocaleString("ru-RU")} ₽
            </span>
          </div>
        </div>
      </section>


      {/* ПОСЕЩЕНИЕ ПАР */}

      <section className="bg-white rounded-3xl border border-gray-100 p-5">

        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900">
              Посещение занятий
            </h3>

            <p className="text-xs text-gray-400 mt-1">
              +{XP_PER_CLASS} XP за каждую пару
            </p>
          </div>

          <div className="text-2xl">
            📚
          </div>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-400">
            Сегодня занятий нет
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => {
              const attended =
                kitten.attended_events.includes(event.id);

              const now = Date.now();
              const start =
                new Date(event.start_time).getTime();

              const end =
                new Date(event.end_time).getTime();

              const available =
                now >= start - 15 * 60 * 1000 &&
                now <= end + 30 * 60 * 1000;

              return (
                <div
                  key={event.id}
                  className="border border-gray-100 rounded-2xl p-3"
                >
                  <div className="flex items-center gap-3">

                    <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center font-bold text-sm">
                      {formatTime(event.start_time)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm break-words">
                        {event.subject}
                      </p>

                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(event.start_time)} —{" "}
                        {formatTime(event.end_time)}
                      </p>
                    </div>

                    {attended ? (
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                    ) : (
                      <button
                        onClick={() => attendClass(event)}
                        disabled={!available || attending === event.id}
                        className="px-3 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        {available
                          ? "Я пришёл"
                          : "Ещё нельзя"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] text-gray-400 mt-3">
          Отметка доступна за 15 минут до начала и до 30 минут после окончания пары.
        </p>
      </section>


      {/* КОСТЮМЫ */}

      <section className="bg-white rounded-3xl border border-gray-100 p-5">

        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900">
              Костюмы
            </h3>

            <p className="text-xs text-gray-400 mt-1">
              Покупаются за деньги из слотов
            </p>
          </div>

          <ShoppingBag className="w-5 h-5 text-gray-400" />
        </div>

        <div className="grid grid-cols-2 gap-3">

          {COSTUMES.map((costume) => {
            const owned =
              kitten.owned_costumes.includes(costume.id);

            const equipped =
              kitten.equipped_costume === costume.id;

            const levelLocked =
              kitten.level < costume.requiredLevel;

            return (
              <div
                key={costume.id}
                className={`rounded-2xl border p-4 ${
                  equipped
                    ? "border-teal-300 bg-teal-50"
                    : "border-gray-100 bg-gray-50"
                }`}
              >

                <div className="text-center">

                  <div className="text-4xl h-12 flex items-center justify-center">
                    {costume.emoji || "🐱"}
                  </div>

                  <p className="font-semibold text-sm text-gray-900 mt-2">
                    {costume.name}
                  </p>

                  {costume.requiredLevel > 1 && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      с {costume.requiredLevel} уровня
                    </p>
                  )}

                  {equipped ? (
                    <button
                      disabled
                      className="w-full mt-3 py-2 rounded-xl bg-teal-100 text-teal-700 text-xs font-semibold"
                    >
                      Надет
                    </button>
                  ) : owned ? (
                    <button
                      onClick={() => equipCostume(costume.id)}
                      className="w-full mt-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-semibold"
                    >
                      Надеть
                    </button>
                  ) : levelLocked ? (
                    <button
                      disabled
                      className="w-full mt-3 py-2 rounded-xl bg-gray-200 text-gray-400 text-xs font-semibold"
                    >
                      <span className="flex items-center justify-center gap-1">
                        <Lock className="w-3 h-3" />
                        Ур. {costume.requiredLevel}
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={() => buyCostume(costume)}
                      disabled={
                        buying === costume.id ||
                        balance < costume.price
                      }
                      className="w-full mt-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      {costume.price.toLocaleString("ru-RU")} ₽
                    </button>
                  )}

                </div>
              </div>
            );
          })}

        </div>
      </section>


      {message && (
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 text-sm text-center text-gray-600">
          {message}
        </div>
      )}

    </div>
  );
}
