import { useState, useEffect } from "react";
import { Flame, Loader2 } from "lucide-react";
import { fetchCandlePrayers, addCandlePrayer } from "@/lib/api";
import type { CandlePrayer } from "@/lib/types";

const CANDLE_WISHES = [
  "Пусть попадётся лёгкий билет!",
  "Ни один вопрос без ответа!",
  "Преподаватель будет добрым!",
  "Хотя бы трояк — и хорошо!",
  "Пусть шпоры не отберут!",
  "Сдам с первого раза!",
  "Комиссия не понадобится!",
  "Пусть хватает времени на всё!",
];

export default function CandleView() {
  const [candleLit, setCandleLit] = useState(false);
  const [candleFlicker, setCandleFlicker] = useState(false);
  const [candleWish, setCandleWish] = useState<string | null>(null);
  const [candleSubject, setCandleSubject] = useState("");
  const [prayers, setPrayers] = useState<CandlePrayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!candleLit) return;
    const flickerInterval = setInterval(() => {
      setCandleFlicker((f) => !f);
    }, 120 + Math.random() * 80);
    return () => clearInterval(flickerInterval);
  }, [candleLit]);

  useEffect(() => {
    loadPrayers();
  }, []);

  async function loadPrayers() {
    try {
      const data = await fetchCandlePrayers();
      setPrayers(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function lightCandle() {
    if (candleLit) return;
    setCandleLit(true);
    const wish = CANDLE_WISHES[Math.floor(Math.random() * CANDLE_WISHES.length)];
    setCandleWish(wish);
    if (candleSubject.trim()) {
      setSaving(true);
      try {
        const newPrayer = await addCandlePrayer(candleSubject.trim(), wish);
        setPrayers((prev) => [newPrayer, ...prev]);
        setCandleSubject("");
      } catch {
        // ignore
      } finally {
        setSaving(false);
      }
    }
  }

  function extinguishCandle() {
    setCandleLit(false);
    setCandleWish(null);
  }

  return (
    <div className="space-y-4">
      {/* Candle card */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-sm border border-amber-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-orange-500" />
          <h3 className="text-sm font-bold text-gray-800">Свечка перед экзаменом</h3>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Поставь свечку, чтобы сдать экзамен. Загадай предмет и нажми — удача на стороне верующих!
        </p>

        {/* Candle visual */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative" style={{ height: "80px" }}>
            {candleLit && (
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: "0px", width: "24px", height: "36px" }}
              >
                <div
                  className={`absolute inset-0 rounded-full transition-all ${candleFlicker ? "scale-95" : "scale-105"}`}
                  style={{
                    background:
                      "radial-gradient(ellipse at center bottom, #fff5a0 0%, #ffcc00 40%, #ff8800 70%, transparent 100%)",
                    filter: "blur(2px)",
                  }}
                />
                <div
                  className={`absolute left-1/2 -translate-x-1/2 rounded-full transition-all ${candleFlicker ? "scale-90" : "scale-100"}`}
                  style={{
                    bottom: "4px",
                    width: "10px",
                    height: "18px",
                    background:
                      "radial-gradient(ellipse at center bottom, #fff 0%, #ffdd44 60%, #ff9900 100%)",
                  }}
                />
              </div>
            )}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: candleLit ? "32px" : "20px",
                width: "2px",
                height: candleLit ? "8px" : "12px",
                background: "#999",
              }}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-md"
              style={{
                top: candleLit ? "40px" : "32px",
                width: "32px",
                height: "40px",
                minHeight: "20px",
                background: "linear-gradient(to right, #f5f5f0, #ffffff, #f5f5f0)",
                boxShadow: "inset 0 -4px 6px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.1)",
                transition: "height 0.5s ease",
              }}
            />
          </div>
        </div>

        {/* Subject input */}
        <input
          type="text"
          value={candleSubject}
          onChange={(e) => setCandleSubject(e.target.value)}
          placeholder="За какой предмет молимся?"
          className="w-full px-3 py-2.5 rounded-xl border border-amber-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white/60 mb-3"
        />

        {/* Wish message */}
        {candleLit && candleWish && (
          <div className="bg-white/70 rounded-xl px-3 py-2 mb-3 text-center">
            <p className="text-sm font-medium text-amber-700 animate-pulse">{candleWish}</p>
          </div>
        )}

        {/* Light / extinguish */}
        {candleLit ? (
          <button
            onClick={extinguishCandle}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-300 transition-colors"
          >
            Потушить
          </button>
        ) : (
          <button
            onClick={lightCandle}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-amber-200 active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
            Поставить свечку
          </button>
        )}
      </div>

      {/* All prayers */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
        </div>
      ) : prayers.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Все молитвы группы</h3>
          <div className="space-y-2">
            {prayers.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <Flame className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="font-medium text-gray-700">{p.subject}</span>
                <span className="text-gray-400 text-xs truncate">— {p.wish}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
