"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  ClipboardList, RotateCw, CheckCircle2, Bell, User,
  Home, BarChart3, Settings, Plus, Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

type TaskStatus = "진행중" | "완료" | "지연";

interface Task {
  id: number;
  name: string;
  person: string;
  status: TaskStatus;
  emoji: string;
}

const weeklyData = [
  { day: "월", progress: 85 },
  { day: "화", progress: 60 },
  { day: "수", progress: 100 },
  { day: "목", progress: 45 },
  { day: "금", progress: 20 },
];

const statusColor: Record<TaskStatus, string> = {
  진행중: "bg-blue-100 text-blue-700",
  완료: "bg-green-100 text-green-700",
  지연: "bg-red-100 text-red-700",
};

export default function Dashboard() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState("홈");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({ name: "", person: "" });
  const [loading, setLoading] = useState(true);

  // Supabase에서 데이터 불러오기
  useEffect(() => {
    checkUserAndFetchTasks();
  }, []);

  async function checkUserAndFetchTasks() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    fetchTasks();
  }

  async function fetchTasks() {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("id", { ascending: true });
    if (error) console.error(error);
    else setTasks(data || []);
    setLoading(false);
  }

  // 업무 추가
  async function addTask() {
    if (!newTask.name || !newTask.person) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .insert([
        {
          name: newTask.name,
          person: newTask.person,
          status: "진행중",
          emoji: "😊",
          user_id: user.id,
        },
      ]);

    if (error) {
      console.error(error);
      alert(error.message);
    } else {
      setNewTask({ name: "", person: "" });
      setShowAddForm(false);
      fetchTasks();
    }
  }

  // 상태 변경
  async function toggleStatus(task: Task) {
    const next: Record<TaskStatus, TaskStatus> = {
      진행중: "완료", 완료: "지연", 지연: "진행중",
    };
    const newStatus = next[task.status];
    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus, emoji: newStatus === "지연" ? "😅" : "😊" })
      .eq("id", task.id);
    if (error) console.error(error);
    else fetchTasks();
  }

  // 업무 삭제
  async function deleteTask(id: number) {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);
    if (error) console.error(error);
    else fetchTasks();
  }

  const total = tasks.length;
  const inProgress = tasks.filter((t) => t.status === "진행중").length;
  const completed = tasks.filter((t) => t.status === "완료").length;
  const delayed = tasks.filter((t) => t.status === "지연").length;

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto relative">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-gray-800">📊 우리팀 업무 대시보드</h1>
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-500" />
            <div className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-600">김부장</span>
            </div>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="text-xs text-red-500 hover:text-red-600"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-24 space-y-4">
        {loading ? (
          <div className="text-center py-10 text-gray-400">불러오는 중...</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <ClipboardList className="w-5 h-5 text-indigo-500" />, label: "전체", value: total, bg: "bg-indigo-50 border-indigo-200" },
                { icon: <RotateCw className="w-5 h-5 text-blue-500" />, label: "진행중", value: inProgress, bg: "bg-blue-50 border-blue-200" },
                { icon: <CheckCircle2 className="w-5 h-5 text-green-500" />, label: "완료", value: completed, bg: "bg-green-50 border-green-200" },
              ].map((card) => (
                <div key={card.label} className={`${card.bg} border rounded-xl p-3 text-center`}>
                  <div className="flex justify-center mb-1">{card.icon}</div>
                  <p className="text-xs text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">📈 이번 주 업무 진행률</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeklyData}>
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${Number(value)}%`, "진행률"]} />
                  <Bar dataKey="progress" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">👥 팀원별 업무 현황</h2>
                <button onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1 text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600 transition">
                  <Plus className="w-3 h-3" />추가
                </button>
              </div>

              {showAddForm && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg space-y-2">
                  <input type="text" placeholder="업무 내용" value={newTask.name}
                    onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <input type="text" placeholder="담당자 이름" value={newTask.person}
                    onChange={(e) => setNewTask({ ...newTask, person: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <button onClick={addTask}
                    className="w-full bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-600 transition">
                    업무 추가하기
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{task.emoji}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{task.person}</p>
                        <p className="text-xs text-gray-500">{task.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleStatus(task)}
                        className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[task.status]}`}>
                        {task.status}
                      </button>
                      <button onClick={() => deleteTask(task.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {delayed > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-red-700 mb-2">⚠️ 지연 알림</h2>
                {tasks.filter((t) => t.status === "지연").map((t) => (
                  <p key={t.id} className="text-xs text-red-600">🔴 {t.person} - {t.name}</p>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t shadow-lg">
        <div className="flex justify-around py-2">
          {[
            { icon: <Home className="w-5 h-5" />, label: "홈" },
            { icon: <ClipboardList className="w-5 h-5" />, label: "업무" },
            { icon: <BarChart3 className="w-5 h-5" />, label: "통계" },
            { icon: <Settings className="w-5 h-5" />, label: "설정" },
          ].map((tab) => (
            <button key={tab.label} onClick={() => setActiveTab(tab.label)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition ${activeTab === tab.label ? "text-indigo-600" : "text-gray-400"}`}>
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}