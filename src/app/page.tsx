"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { isHoliday } from "korean-holidays";

const MANUAL_HOLIDAYS: Record<string, string> = {
  "2026-05-01": "근로자의날",
  "2026-06-03": "지방선거",
};

function getHolidayName(date: Date): string | null {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;
  if (MANUAL_HOLIDAYS[dateStr]) return MANUAL_HOLIDAYS[dateStr];
  const holiday = isHoliday(date, { includeSubstitute: true });
  if (holiday) return (holiday as any).nameKo || null;
  return null;
}

import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import {
  ClipboardList, Bell, User, Home, BarChart3, Settings,
  Plus, Trash2, Calendar, ChevronLeft, ChevronRight, X, Save,
  CheckSquare, Sun, Moon,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

type TaskStatus = "예정" | "진행중" | "완료" | "지연";

interface Task {
  id: number;
  name: string;
  person: string;
  status: TaskStatus;
  emoji: string;
  start_date: string | null;
  end_date: string | null;
  detail: string | null;
}

function formatShort(d: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}`;
}
function formatMonthDay(d: Date) {
  return `${d.getMonth() + 1}.${d.getDate()}`;
}
function formatFull(d: string | null) {
  if (!d) return "";
  return d.replace(/-/g, ".");
}
function dateRangeShort(s: string | null, e: string | null) {
  if (!s && !e) return "";
  if (s && e) return `${formatShort(s)}~${formatShort(e)}`;
  return s ? `${formatShort(s)}~` : `~${formatShort(e)}`;
}
function dateRangeFull(s: string | null, e: string | null) {
  if (!s && !e) return "";
  if (s && e) return `${formatFull(s)} ~ ${formatFull(e)}`;
  return s ? `${formatFull(s)} ~` : `~ ${formatFull(e)}`;
}
function parseExcelDate(v: any): string | null {
  if (!v) return null;
  const s = String(v).trim().replace(/-/g, "").replace(/\./g, "");
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return null;
}
function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function getWeekDates(baseDate = new Date()) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
function getDateTextColor(date: Date) {
  const day = date.getDay();
  const isKrHoliday = Boolean(getHolidayName(date));
  if (day === 0 || isKrHoliday) return "text-red-500";
  if (day === 6) return "text-blue-500";
  return "text-gray-500 dark:text-gray-400";
}
function getDayHeaderTextColor(dayIndex: number) {
  if (dayIndex === 0) return "text-red-500";
  if (dayIndex === 6) return "text-blue-500";
  return "text-gray-400";
}
function isTaskActiveOnDate(task: Task, dateStr: string) {
  return Boolean(task.start_date && task.end_date && task.start_date <= dateStr && dateStr <= task.end_date);
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  예정: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  진행중: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  완료: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  지연: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};
const STATUS_NEXT: Record<TaskStatus, TaskStatus> = {
  예정: "진행중", 진행중: "완료", 완료: "지연", 지연: "예정",
};
const PERSON_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];

function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-6">
        <p className="text-center text-base font-medium text-gray-800 dark:text-gray-100">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm}
            className="flex-1 bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-600 transition">
            확인
          </button>
          <button onClick={onCancel}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState("홈");
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({ name: "", person: "", start_date: "", end_date: "" });
  const [statusFilter, setStatusFilter] = useState("전체");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [calDate, setCalDate] = useState(new Date());
  const [selectedCalTask, setSelectedCalTask] = useState<Task | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // 다크모드 초기화
  useEffect(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved === "true") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("darkMode", String(next));
    if (next) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  useEffect(() => { checkAndFetch(); }, []);

  async function checkAndFetch() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    fetchTasks();
  }

  async function fetchTasks() {
    const { data, error } = await supabase.from("tasks").select("*").order("id", { ascending: true });
    if (error) console.error(error);
    else setTasks(data || []);
    setLoading(false);
  }

  async function addTask() {
    if (!newTask.name || !newTask.person) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { error } = await supabase.from("tasks").insert([{
      name: newTask.name, person: newTask.person,
      status: "예정", emoji: "😊", user_id: user.id,
      start_date: newTask.start_date || null,
      end_date: newTask.end_date || null,
      detail: null,
    }]);
    if (error) { alert(error.message); return; }
    setNewTask({ name: "", person: "", start_date: "", end_date: "" });
    setShowAddForm(false);
    fetchTasks();
  }

  function confirmSaveEdit() {
    setConfirmDialog({
      message: "정말 저장하시겠습니까?",
      onConfirm: async () => {
        setConfirmDialog(null);
        if (!editTask) return;
        const { error } = await supabase.from("tasks").update({
          name: editTask.name, person: editTask.person,
          status: editTask.status, start_date: editTask.start_date,
          end_date: editTask.end_date, detail: editTask.detail,
          emoji: editTask.status === "지연" ? "😅" : "😊",
        }).eq("id", editTask.id);
        if (error) { alert(error.message); return; }
        setSelectedTask(null); setEditTask(null);
        fetchTasks();
      },
    });
  }

  function confirmDeleteSingle(id: number) {
    setConfirmDialog({
      message: "정말 삭제하시겠습니까?",
      onConfirm: async () => {
        setConfirmDialog(null);
        await supabase.from("tasks").delete().eq("id", id);
        setSelectedTask(null); setEditTask(null);
        fetchTasks();
      },
    });
  }

  function confirmDeleteSelected() {
    const count = selectedIds.size;
    if (count === 0) return;
    setConfirmDialog({
      message: `${count}개의 업무를 삭제하시겠습니까?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        await supabase.from("tasks").delete().in("id", Array.from(selectedIds));
        setSelectedIds(new Set()); setSelectMode(false);
        fetchTasks();
      },
    });
  }

  async function toggleStatus(task: Task) {
    const newStatus = STATUS_NEXT[task.status];
    await supabase.from("tasks").update({ status: newStatus, emoji: newStatus === "지연" ? "😅" : "😊" }).eq("id", task.id);
    fetchTasks();
  }

  async function handleExcelUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!validTypes.includes(file.type)) { alert("❌ 엑셀 파일(.xlsx, .xls)만 업로드 가능합니다!"); event.target.value = ""; return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert("로그인이 필요합니다."); return; }
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
    if (jsonData.length === 0) { alert("❌ 파일에 데이터가 없습니다!"); event.target.value = ""; return; }
    const firstRow = jsonData[0];
    if (!firstRow["업무내용"] && !firstRow["담당자"]) { alert("❌ 올바른 양식이 아닙니다!"); event.target.value = ""; return; }
    const formattedData = jsonData
      .filter((row: any) => row["업무내용"] && row["담당자"])
      .map((row: any) => ({
        name: String(row["업무내용"]).trim(), person: String(row["담당자"]).trim(),
        status: (row["상태"] as TaskStatus) || "예정", emoji: "😊", user_id: user.id,
        start_date: parseExcelDate(row["업무시작날짜"]), end_date: parseExcelDate(row["업무종료날짜"]), detail: null,
      }));
    if (formattedData.length === 0) { alert("❌ 업로드할 유효한 데이터가 없습니다!"); event.target.value = ""; return; }
    const { error } = await supabase.from("tasks").insert(formattedData);
    if (error) { alert("❌ 업로드 실패: " + error.message); }
    else { alert(`✅ ${formattedData.length}개 업무가 업로드됐습니다!`); fetchTasks(); }
    event.target.value = "";
  }

  function downloadTemplate() {
    const headers = ["담당자", "상태", "업무시작날짜", "업무종료날짜", "업무내용"];
    const templateData = [
      { 담당자: "홍길동", 상태: "진행중", 업무시작날짜: "20260513", 업무종료날짜: "20260520", 업무내용: "보고서 작성" },
      { 담당자: "김철수", 상태: "완료", 업무시작날짜: "20260510", 업무종료날짜: "20260515", 업무내용: "미팅 준비" },
      { 담당자: "이영희", 상태: "지연", 업무시작날짜: "20260513", 업무종료날짜: "20260525", 업무내용: "데이터 분석" },
      { 담당자: "박대리", 상태: "예정", 업무시작날짜: "20260520", 업무종료날짜: "20260530", 업무내용: "기획안 제출" },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "업무목록");
    XLSX.writeFile(wb, "업무양식.xlsx");
  }

  function toggleSelect(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }
  function exitSelectMode() { setSelectMode(false); setSelectedIds(new Set()); }

  const total = tasks.length;
  const scheduled = tasks.filter((t) => t.status === "예정").length;
  const inProgress = tasks.filter((t) => t.status === "진행중").length;
  const completed = tasks.filter((t) => t.status === "완료").length;
  const delayed = tasks.filter((t) => t.status === "지연").length;

  const pieData = [
    { name: "예정", value: scheduled, color: "#9ca3af" },
    { name: "진행중", value: inProgress, color: "#3b82f6" },
    { name: "완료", value: completed, color: "#10b981" },
    { name: "지연", value: delayed, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  const persons = [...new Set(tasks.map((t) => t.person))];
  const personColorMap: Record<string, string> = {};
  persons.forEach((p, i) => { personColorMap[p] = PERSON_COLORS[i % PERSON_COLORS.length]; });

  const personData = persons.map((p) => ({
    name: p,
    완료: tasks.filter((t) => t.person === p && t.status === "완료").length,
    진행중: tasks.filter((t) => t.person === p && t.status === "진행중").length,
    지연: tasks.filter((t) => t.person === p && t.status === "지연").length,
    예정: tasks.filter((t) => t.person === p && t.status === "예정").length,
  }));

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekDates = getWeekDates(new Date());

  function getTasksForDate(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return tasks.filter((t) => isTaskActiveOnDate(t, dateStr));
  }
  function getTasksForDateString(dateStr: string) {
    return tasks.filter((t) => isTaskActiveOnDate(t, dateStr));
  }

  const filteredTasks = statusFilter === "전체" ? tasks : tasks.filter((t) => t.status === statusFilter);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors duration-200">

      {/* 헤더 */}
      <header className="bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-20 border-b border-transparent dark:border-gray-800">
        <div className="w-full px-4 md:px-8 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">📊 기획그룹 업무 대시보드</h1>
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-1">
              <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">김부장</span>
            </div>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
              className="text-xs text-red-500 hover:text-red-600">로그아웃</button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 md:px-8 py-4 pb-24">
        {loading ? (
          <div className="text-center py-10 text-gray-400 dark:text-gray-500">불러오는 중...</div>
        ) : (
          <>
            {/* ══ 홈 탭 ══ */}
            {activeTab === "홈" && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "예정", value: scheduled, bg: "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700", text: "text-gray-600 dark:text-gray-300" },
                    { label: "진행중", value: inProgress, bg: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900", text: "text-blue-600 dark:text-blue-400" },
                    { label: "완료", value: completed, bg: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900", text: "text-green-600 dark:text-green-400" },
                    { label: "지연", value: delayed, bg: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900", text: "text-red-600 dark:text-red-400" },
                  ].map((card) => (
                    <div key={card.label} className={`${card.bg} border rounded-xl p-3 text-center`}>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
                      <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">📈 이번 주 업무 진행률</h2>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={[
                      { day: "월", progress: 85 }, { day: "화", progress: 60 },
                      { day: "수", progress: 100 }, { day: "목", progress: 45 }, { day: "금", progress: 20 },
                    ]}>
                      <XAxis dataKey="day" tick={{ fontSize: 12, fill: darkMode ? "#9ca3af" : "#6b7280" }} />
                      <YAxis tick={{ fontSize: 12, fill: darkMode ? "#9ca3af" : "#6b7280" }} domain={[0, 100]} />
                      <Tooltip
                        formatter={(v) => [`${Number(v)}%`, "진행률"]}
                        contentStyle={{ backgroundColor: darkMode ? "#1f2937" : "#fff", border: "none", borderRadius: "8px", color: darkMode ? "#f9fafb" : "#111" }}
                      />
                      <Bar dataKey="progress" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">👥 팀원별 업무 현황</h2>
                    <span className="text-xs text-gray-400 dark:text-gray-500">업무 수정은 업무 탭에서 가능</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl flex-shrink-0">{task.emoji}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{task.person}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{task.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {(task.start_date || task.end_date) && (
                            <span className="text-xs text-gray-700 dark:text-gray-300">{dateRangeShort(task.start_date, task.end_date)}</span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[task.status]}`}>{task.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {delayed > 0 && (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">⚠️ 지연 알림</h2>
                    {tasks.filter((t) => t.status === "지연").map((t) => (
                      <p key={t.id} className="text-xs text-red-600 dark:text-red-400">🔴 {t.person} - {t.name}</p>
                    ))}
                  </div>
                )}

                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">📅 팀원 이번주 일정</h2>
                  <div className="grid grid-cols-7 gap-1 overflow-visible">
                    {weekDates.map((date) => {
                      const dateStr = toDateString(date);
                      const dayTasks = getTasksForDateString(dateStr);
                      const dayIndex = date.getDay();
                      return (
                        <div key={dateStr} className="min-h-[110px] rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1 overflow-visible">
                          <p className={`text-xs font-semibold mb-0.5 px-0.5 ${getDateTextColor(date)}`}>{formatMonthDay(date)}</p>
                          <p className={`text-[10px] mb-1 px-0.5 ${getDayHeaderTextColor(dayIndex)}`}>
                            {["일", "월", "화", "수", "목", "금", "토"][dayIndex]}
                          </p>
                          <div className="space-y-1 overflow-visible">
                            {dayTasks.map((task) => (
                              <div key={task.id} className="relative group overflow-visible">
                                <div className="rounded px-1 py-0.5 cursor-default"
                                  style={{ backgroundColor: `${personColorMap[task.person] || "#6366f1"}22`, borderLeft: `3px solid ${personColorMap[task.person] || "#6366f1"}` }}>
                                  <p className="truncate leading-tight font-medium"
                                    style={{ fontSize: "10px", color: task.status === "지연" ? "#ef4444" : task.status === "예정" ? "#10b981" : darkMode ? "#e5e7eb" : "#1f2937", textDecoration: task.status === "완료" ? "line-through" : "none" }}>
                                    {task.name}
                                  </p>
                                  <p className="truncate leading-tight text-[9px] text-gray-500 dark:text-gray-400">{task.person}</p>
                                </div>
                                <div className="pointer-events-none absolute left-0 bottom-full mb-1 z-50 hidden w-56 rounded-lg border bg-white dark:bg-gray-800 dark:border-gray-700 p-3 text-xs shadow-xl group-hover:block">
                                  <p className="font-bold text-indigo-700 dark:text-indigo-400">{task.person}</p>
                                  <p className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{task.name}</p>
                                  <p className="text-gray-500 dark:text-gray-400 mt-1">일정: {dateRangeFull(task.start_date, task.end_date)}</p>
                                  <p className="text-gray-500 dark:text-gray-400">상태: {task.status}</p>
                                  {task.detail && <p className="text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap">{task.detail}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {persons.map((p) => (
                      <div key={p} className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: personColorMap[p] }} />
                        <span className="text-xs text-gray-600 dark:text-gray-400">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══ 업무 탭 ══ */}
            {activeTab === "업무" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition cursor-pointer">
                    엑셀업로드
                    <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
                  </label>
                  <button onClick={downloadTemplate} className="text-xs bg-gray-500 text-white px-3 py-1.5 rounded-lg hover:bg-gray-600 transition">양식다운로드</button>
                  <button onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-1 text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600 transition">
                    <Plus className="w-3 h-3" />추가
                  </button>
                  {!selectMode ? (
                    <button onClick={() => setSelectMode(true)}
                      className="flex items-center gap-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                      <CheckSquare className="w-3 h-3" />선택
                    </button>
                  ) : (
                    <>
                      <button onClick={confirmDeleteSelected} disabled={selectedIds.size === 0}
                        className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition ${selectedIds.size > 0 ? "bg-red-500 text-white hover:bg-red-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"}`}>
                        <Trash2 className="w-3 h-3" />{selectedIds.size > 0 ? `${selectedIds.size}개 삭제` : "삭제"}
                      </button>
                      <button onClick={exitSelectMode}
                        className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                        취소
                      </button>
                    </>
                  )}
                </div>

                {showAddForm && (
                  <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
                    <input type="text" placeholder="업무 내용" value={newTask.name}
                      onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <input type="text" placeholder="담당자 이름" value={newTask.person}
                      onChange={(e) => setNewTask({ ...newTask, person: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <div className="flex gap-2">
                      <input type="date" value={newTask.start_date}
                        onChange={(e) => setNewTask({ ...newTask, start_date: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                      <input type="date" value={newTask.end_date}
                        onChange={(e) => setNewTask({ ...newTask, end_date: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <button onClick={addTask} className="w-full bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-600 transition">업무 추가하기</button>
                  </div>
                )}

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {["전체", "예정", "진행중", "완료", "지연"].map((s) => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium border transition ${statusFilter === s ? "bg-indigo-500 text-white border-indigo-500" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"}`}>
                      {s} ({s === "전체" ? total : s === "예정" ? scheduled : s === "진행중" ? inProgress : s === "완료" ? completed : delayed})
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {filteredTasks.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-4 col-span-3">해당 업무가 없어요!</p>
                  ) : filteredTasks.map((task) => (
                    <div key={task.id}
                      className={`flex items-center justify-between p-3 bg-white dark:bg-gray-900 border rounded-lg transition cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${selectedIds.has(task.id) ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950" : "border-gray-200 dark:border-gray-700"}`}
                      onClick={() => { if (selectMode) { toggleSelect(task.id); } else { setSelectedTask(task); setEditTask({ ...task }); } }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl flex-shrink-0">{task.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{task.person}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{task.name}</p>
                          {(task.start_date || task.end_date) && (
                            <p className="text-xs text-gray-400 dark:text-gray-500">{dateRangeFull(task.start_date, task.end_date)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => !selectMode && toggleStatus(task)}
                          className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[task.status]} ${selectMode ? "cursor-default" : ""}`}>
                          {task.status}
                        </button>
                        {selectMode && (
                          <input type="checkbox" checked={selectedIds.has(task.id)} onChange={() => toggleSelect(task.id)}
                            className="w-4 h-4 accent-indigo-500" onClick={(e) => e.stopPropagation()} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ 통계 탭 ══ */}
            {activeTab === "통계" && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">📊 전체 완료율</h2>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-3">
                      <div className="bg-green-500 h-3 rounded-full transition-all"
                        style={{ width: `${total > 0 ? Math.round((completed / total) * 100) : 0}%` }} />
                    </div>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      {total > 0 ? Math.round((completed / total) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">🥧 상태별 현황</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name} ${value}`}>
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: darkMode ? "#1f2937" : "#fff", border: "none", borderRadius: "8px", color: darkMode ? "#f9fafb" : "#111" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">👥 담당자별 현황</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={personData}>
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: darkMode ? "#9ca3af" : "#6b7280" }} />
                        <YAxis tick={{ fontSize: 11, fill: darkMode ? "#9ca3af" : "#6b7280" }} />
                        <Tooltip contentStyle={{ backgroundColor: darkMode ? "#1f2937" : "#fff", border: "none", borderRadius: "8px", color: darkMode ? "#f9fafb" : "#111" }} />
                        <Bar dataKey="완료" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="진행중" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="지연" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="예정" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ══ 캘린더 탭 ══ */}
            {activeTab === "캘린더" && (
              <div className="flex flex-col xl:flex-row gap-4">
                <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 transition-all ${selectedCalTask ? "w-full xl:w-1/2" : "w-full"}`}>
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCalDate(new Date(year, month - 1, 1))}>
                      <ChevronLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{year}년 {month + 1}월</h2>
                    <button onClick={() => setCalDate(new Date(year, month + 1, 1))}>
                      <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 mb-1">
                    {["일", "월", "화", "수", "목", "금", "토"].map((d, index) => (
                      <div key={d} className={`text-center text-xs font-medium py-1 ${getDayHeaderTextColor(index)}`}>{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const date = new Date(year, month, day);
                      const dayTasks = getTasksForDate(day);
                      return (
                        <div key={day} className="min-h-[70px] border border-gray-100 dark:border-gray-800 rounded p-0.5">
                          <p className={`text-xs mb-0.5 px-0.5 font-medium ${getDateTextColor(date)}`}>
                            {day}
                            {getHolidayName(date) && <span className="block text-[8px] leading-tight">{getHolidayName(date)}</span>}
                          </p>
                          {dayTasks.map((task) => (
                            <div key={task.id}
                              className="rounded mb-0.5 px-1 py-0.5 cursor-pointer hover:opacity-80"
                              style={{ backgroundColor: `${personColorMap[task.person] || "#6366f1"}22`, borderLeft: `3px solid ${personColorMap[task.person] || "#6366f1"}` }}
                              onClick={() => setSelectedCalTask(selectedCalTask?.id === task.id ? null : task)}>
                              <p className="truncate leading-tight" style={{ fontSize: "8px", color: personColorMap[task.person] || "#6366f1" }}>{task.person}</p>
                              <p className="truncate leading-tight"
                                style={{ fontSize: "10px", color: task.status === "지연" ? "#ef4444" : task.status === "예정" ? "#10b981" : darkMode ? "#e5e7eb" : "#1f2937", textDecoration: task.status === "완료" ? "line-through" : "none", fontWeight: 500 }}>
                                {task.name}
                              </p>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {persons.map((p) => (
                      <div key={p} className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: personColorMap[p] }} />
                        <span className="text-xs text-gray-600 dark:text-gray-400">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedCalTask && (
                  <div className="w-full xl:w-1/2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">📋 업무 상세</h2>
                      <button onClick={() => setSelectedCalTask(null)}>
                        <X className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      </button>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2">
                      <div className="flex-1 bg-indigo-50 dark:bg-indigo-950 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">담당자</p>
                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{selectedCalTask.person}</p>
                      </div>
                      <div className="flex-1 bg-indigo-50 dark:bg-indigo-950 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">일정</p>
                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{dateRangeFull(selectedCalTask.start_date, selectedCalTask.end_date)}</p>
                      </div>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">업무내용</p>
                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{selectedCalTask.name}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[selectedCalTask.status]}`}>{selectedCalTask.status}</span>
                    </div>
                    {selectedCalTask.detail && (
                      <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">업무 상세</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedCalTask.detail}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ══ 설정 탭 ══ */}
            {activeTab === "설정" && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-4 max-w-md">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">⚙️ 설정</h2>

                {/* 다크모드 토글 */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <div className="flex items-center gap-2">
                    {darkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-yellow-500" />}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {darkMode ? "다크모드" : "라이트모드"}
                    </span>
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${darkMode ? "bg-indigo-500" : "bg-gray-300"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${darkMode ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>

                <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
                  className="w-full bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 py-2 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900 transition">
                  로그아웃
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg z-20">
        <div className="w-full flex justify-around py-2">
          {[
            { icon: <Home className="w-5 h-5" />, label: "홈" },
            { icon: <ClipboardList className="w-5 h-5" />, label: "업무" },
            { icon: <BarChart3 className="w-5 h-5" />, label: "통계" },
            { icon: <Calendar className="w-5 h-5" />, label: "캘린더" },
            { icon: <Settings className="w-5 h-5" />, label: "설정" },
          ].map((tab) => (
            <button key={tab.label} onClick={() => setActiveTab(tab.label)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition ${activeTab === tab.label ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-600"}`}>
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ══ 업무 상세 팝업 ══ */}
      {selectedTask && editTask && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">업무</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => confirmDeleteSingle(selectedTask.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => { setSelectedTask(null); setEditTask(null); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">담당자</label>
                <input value={editTask.person} onChange={(e) => setEditTask({ ...editTask, person: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">업무내용</label>
                <input value={editTask.name} onChange={(e) => setEditTask({ ...editTask, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">상태</label>
                <select value={editTask.status} onChange={(e) => setEditTask({ ...editTask, status: e.target.value as TaskStatus })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {(["예정", "진행중", "완료", "지연"] as TaskStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">시작일</label>
                  <input type="date" value={editTask.start_date || ""} onChange={(e) => setEditTask({ ...editTask, start_date: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 dark:text-gray-400">종료일</label>
                  <input type="date" value={editTask.end_date || ""} onChange={(e) => setEditTask({ ...editTask, end_date: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">업무 상세</label>
                <textarea value={editTask.detail || ""} onChange={(e) => setEditTask({ ...editTask, detail: e.target.value })}
                  rows={4} placeholder="상세 내용을 입력하세요..."
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={confirmSaveEdit}
                className="flex-1 bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-600 transition flex items-center justify-center gap-1">
                <Save className="w-4 h-4" />저장
              </button>
              <button onClick={() => { setSelectedTask(null); setEditTask(null); }}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 확인 팝업 ══ */}
      {confirmDialog && (
        <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />
      )}
    </div>
  );
}
