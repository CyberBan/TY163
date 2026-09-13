import { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  Check,
  Trash2,
  Calendar,
  X,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { fetchHomework, addHomework, toggleHomework, deleteHomework } from "@/lib/api";
import type { Homework } from "@/lib/types";

export default function HomeworkView() {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formSubject, setFormSubject] = useState("");
  const [formText, setFormText] = useState("");
  const [formDueDate, setFormDueDate] = useState("");

  const subjects = [
    "Общая и неорганическая химия",
    "Физика",
    "Математика",
    "Основы права",
    "Иностранный язык",
    "Основы российской государственности",
    "Инженерная графика",
    "Введение в информационные технологии",
    "Основы экологии",
    "Физическая культура",
    "Физическая подготовка (элективные курсы)",
  ];

  useEffect(() => {
    loadHomework();
  }, []);

  async function loadHomework() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchHomework();
      setHomework(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load homework");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formSubject.trim() || !formText.trim()) return;
    try {
      const newHw = await addHomework(formSubject.trim(), formText.trim(), formDueDate || null);
      setHomework((prev) => [newHw, ...prev]);
      setFormSubject("");
      setFormText("");
      setFormDueDate("");
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add homework");
    }
  }

  async function handleToggle(id: string, completed: boolean) {
    try {
      await toggleHomework(id, !completed);
      setHomework((prev) =>
        prev.map((h) => (h.id === id ? { ...h, completed: !completed } : h))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update homework");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteHomework(id);
      setHomework((prev) => prev.filter((h) => h.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete homework");
    }
  }

  const pending = homework.filter((h) => !h.completed);
  const completed = homework.filter((h) => h.completed);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <BookOpen className="w-8 h-8 text-teal-600 animate-pulse" />
          <p className="text-gray-500 text-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add button / form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Новая домашка</h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="p-1 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Предмет</label>
            <select
              value={formSubject}
              onChange={(e) => setFormSubject(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
            >
              <option value="">Выберите предмет</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Задание</label>
            <textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="Что задали?"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Сдать до (необязательно)</label>
            <input
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
            />
          </div>

          <button
            type="submit"
            disabled={!formSubject.trim() || !formText.trim()}
            className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-medium text-sm hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Добавить
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-teal-600 text-white rounded-xl font-medium text-sm hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить домашку
        </button>
      )}

      {/* Pending homework */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-2 px-1">
            Нужно сделать ({pending.length})
          </h3>
          <div className="space-y-2.5">
            {pending.map((hw) => (
              <HomeworkCard key={hw.id} hw={hw} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Completed homework */}
      {completed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2 px-1">
            Сделано ({completed.length})
          </h3>
          <div className="space-y-2.5">
            {completed.map((hw) => (
              <HomeworkCard key={hw.id} hw={hw} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {homework.length === 0 && !showForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Пока нет домашки. Добавьте первую!</p>
        </div>
      )}
    </div>
  );
}

function HomeworkCard({
  hw,
  onToggle,
  onDelete,
}: {
  hw: Homework;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const dueDate = hw.due_date ? new Date(hw.due_date) : null;
  const isOverdue = dueDate && !hw.completed && dueDate < new Date(new Date().toDateString());

  return (
    <div className={`bg-white rounded-2xl shadow-sm border p-4 transition-all ${hw.completed ? "border-gray-100 opacity-60" : "border-gray-100"}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(hw.id, hw.completed)}
          className={`mt-0.5 flex-shrink-0 transition-colors ${hw.completed ? "text-teal-600" : "text-gray-300 hover:text-teal-500"}`}
        >
          {hw.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${hw.completed ? "text-gray-400 line-through" : "text-gray-900"}`}>
            {hw.subject}
          </p>
          <p className={`text-sm mt-1 ${hw.completed ? "text-gray-400 line-through" : "text-gray-600"}`}>
            {hw.text}
          </p>
          {dueDate && (
            <div className={`flex items-center gap-1.5 mt-2 text-xs ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Сдать до: {dueDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                {isOverdue && " (просрочено)"}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => onDelete(hw.id)}
          className="flex-shrink-0 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
