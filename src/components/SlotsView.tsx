import { useState, useRef, useEffect, useCallback } from "react";
import { Dices, RotateCcw, Trophy, Sparkles, Loader2 } from "lucide-react";
import { fetchSlotsState, upsertSlotsState, updateProfileStats, fetchProfile } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const SYMBOLS = [
  { emoji: "📚", label: "Книга", weight: 30 },
  { emoji: "⚗️", label: "Колба", weight: 25 },
  { emoji: "📐", label: "Линейка", weight: 20 },
  { emoji: "🎓", label: "Диплом", weight: 15 },
  { emoji: "🔥", label: "Огонь", weight: 7 },
  { emoji: "💰", label: "Стипендия", weight: 3 },
];

const PAYOUTS: Record<string, number> = {
  "💰": 100,
  "🔥": 50,
  "🎓": 25,
  "📐": 15,
  "⚗️": 10,
  "📚": 5,
};

interface ReelState {
  symbol: typeof SYMBOLS[0];
  spinning: boolean;
}

function pickWeighted(): typeof SYMBOLS[0] {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const sym of SYMBOLS) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return SYMBOLS[0];
}

export default function SlotsView() {
  const [reels, setReels] = useState<ReelState[]>([
    { symbol: SYMBOLS[0], spinning: false },
    { symbol: SYMBOLS[1], spinning: false },
    { symbol: SYMBOLS[2], spinning: false },
  ]);
  const [spinning, setSpinning] = useState(false);
  const [balance, setBalance] = useState(1000);
  const [bet, setBet] = useState(50);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [winMessage, setWinMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<{ win: number; symbols: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalWon, setTotalWon] = useState(0);
  const [spins, setSpins] = useState(0);
  const [maxBalance, setMaxBalance] = useState(1000);
  const spinTimers = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    loadState();
    return () => {
      spinTimers.current.forEach(clearInterval);
    };
  }, []);

  async function loadState() {
    try {
      const state = await fetchSlotsState();
      const profile = await fetchProfile((await supabase.auth.getUser()).data.user!.id);
      if (state) {
        setBalance(state.balance);
        setBet(state.bet);
        setHistory(state.history || []);
      }
      if (profile) {
        setTotalWon(profile.total_won);
        setSpins(profile.spins);
        setMaxBalance(profile.max_balance);
        if (state && state.balance > profile.max_balance) {
          setMaxBalance(state.balance);
        }
      }
    } catch {
      // ignore — defaults are fine
    } finally {
      setLoading(false);
    }
  }

  async function saveState(newBalance: number, newBet: number, newHistory: { win: number; symbols: string }[], won: number) {
    try {
      await upsertSlotsState(newBalance, newBet, newHistory);
      const newSpins = spins + 1;
      const newTotalWon = totalWon + won;
      const newMax = Math.max(maxBalance, newBalance);
      setSpins(newSpins);
      setTotalWon(newTotalWon);
      setMaxBalance(newMax);
      await updateProfileStats(newMax, newTotalWon, newSpins);
    } catch {
      // silent fail — state saved on next spin
    }
  }

  const spin = useCallback(() => {
    if (spinning || balance < bet) return;

    setSpinning(true);
    setLastWin(null);
    setWinMessage(null);
    setBalance((b) => b - bet);

    const finalSymbols = [pickWeighted(), pickWeighted(), pickWeighted()];

    for (let i = 0; i < 3; i++) {
      const interval = setInterval(() => {
        setReels((prev) => {
          const copy = [...prev];
          copy[i] = { symbol: pickWeighted(), spinning: true };
          return copy;
        });
      }, 80);
      spinTimers.current.push(interval);

      setTimeout(
        () => {
          clearInterval(interval);
          spinTimers.current = spinTimers.current.filter((t) => t !== interval);
          setReels((prev) => {
            const copy = [...prev];
            copy[i] = { symbol: finalSymbols[i], spinning: false };
            return copy;
          });

          if (i === 2) {
            setTimeout(() => {
              setSpinning(false);
              const all = finalSymbols;
              const allMatch = all[0].emoji === all[1].emoji && all[1].emoji === all[2].emoji;
              const twoMatch =
                all[0].emoji === all[1].emoji || all[1].emoji === all[2].emoji || all[0].emoji === all[2].emoji;

              let win = 0;
              let msg: string | null = null;

              if (allMatch) {
                win = bet * (PAYOUTS[all[0].emoji] || 5);
                if (all[0].emoji === "💰") msg = "ДЖЕКПОТ! Стипендия получена!";
                else if (all[0].emoji === "🔥") msg = "Огненный выигрыш!";
                else msg = `Три в ряд! +${win}`;
              } else if (twoMatch) {
                const matchSym =
                  all[0].emoji === all[1].emoji ? all[0] : all[1].emoji === all[2].emoji ? all[1] : all[0];
                win = Math.floor(bet * (PAYOUTS[matchSym.emoji] || 5) * 0.3);
                msg = `Пара! +${win}`;
              }

              const newBalance = win > 0 ? balance - bet + win : balance - bet;
              if (win > 0) {
                setBalance(newBalance);
                setLastWin(win);
                setWinMessage(msg);
              } else {
                setBalance(newBalance);
                setLastWin(0);
              }

              const newHistory = [
                { win, symbols: all.map((s) => s.emoji).join("") },
                ...history.slice(0, 9),
              ];
              setHistory(newHistory);
              saveState(newBalance, bet, newHistory, win);
            }, 150);
          }
        },
        600 + i * 400
      );
    }
  }, [spinning, balance, bet, history, totalWon, spins, maxBalance]);

  const canSpin = !spinning && balance >= bet;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Balance */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-teal-100 text-xs font-medium">Баланс</p>
            <p className="text-3xl font-bold mt-0.5">{balance.toLocaleString("ru-RU")} ₽</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="flex gap-3 mt-3">
          {lastWin !== null && lastWin > 0 && (
            <div className="bg-white/20 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span className="text-sm font-medium">+{lastWin} ₽</span>
            </div>
          )}
          <div className="bg-white/10 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
            <span className="text-xs text-teal-100">Рекорд: {maxBalance.toLocaleString("ru-RU")} ₽</span>
          </div>
        </div>
      </div>

      {/* Slot machine */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="bg-gray-900 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-center gap-2">
            {reels.map((reel, i) => (
              <div
                key={i}
                className={`flex-1 aspect-square max-w-[80px] bg-white rounded-xl flex items-center justify-center text-4xl transition-all ${
                  reel.spinning ? "scale-90 opacity-70" : "scale-100 opacity-100"
                }`}
              >
                <span className={reel.spinning ? "animate-pulse" : ""}>
                  {reel.symbol.emoji}
                </span>
              </div>
            ))}
          </div>
        </div>

        {winMessage && (
          <div className="text-center mb-3">
            <p className="text-sm font-bold text-teal-600 animate-pulse">{winMessage}</p>
          </div>
        )}

        {/* Bet selector */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-500">Ставка</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBet((b) => Math.max(10, b - 10))}
              disabled={spinning}
              className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold flex items-center justify-center disabled:opacity-40"
            >
              −
            </button>
            <span className="text-sm font-bold text-gray-900 w-12 text-center">{bet} ₽</span>
            <button
              onClick={() => setBet((b) => Math.min(balance, b + 10))}
              disabled={spinning}
              className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold flex items-center justify-center disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        {/* Spin button */}
        <button
          onClick={spin}
          disabled={!canSpin}
          className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm transition-all ${
            canSpin
              ? "bg-gradient-to-r from-teal-600 to-teal-700 text-white hover:from-teal-700 hover:to-teal-800 shadow-md shadow-teal-200 active:scale-95"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          <Dices className={`w-5 h-5 ${spinning ? "animate-spin" : ""}`} />
          {spinning ? "Крутим..." : "Крутить"}
        </button>

        {balance < bet && !spinning && (
          <p className="text-center text-xs text-red-500 mt-2">Не хватает баланса на ставку</p>
        )}
      </div>

      {/* Payouts */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Выплаты (3 в ряд)</h3>
        <div className="grid grid-cols-3 gap-2">
          {SYMBOLS.map((sym) => (
            <div key={sym.emoji} className="flex flex-col items-center bg-gray-50 rounded-lg py-2">
              <span className="text-2xl mb-1">{sym.emoji}</span>
              <span className="text-xs font-bold text-gray-700">×{PAYOUTS[sym.emoji] || 5}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">Пара символов = 30% от выплаты</p>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">История</h3>
          <div className="space-y-1.5">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-lg">{h.symbols}</span>
                <span className={h.win > 0 ? "text-teal-600 font-medium" : "text-gray-400"}>
                  {h.win > 0 ? `+${h.win} ₽` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reset */}
      {balance < bet && (
        <button
          onClick={async () => {
            const newBalance = 1000;
            setBalance(newBalance);
            setLastWin(null);
            setWinMessage(null);
            await upsertSlotsState(newBalance, bet, history);
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-100 text-gray-500 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Пополнить баланс
        </button>
      )}
    </div>
  );
}
