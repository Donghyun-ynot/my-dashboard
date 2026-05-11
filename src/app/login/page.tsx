"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");

  async function handleAuth() {
    setMessage("");

    if (!email || !password) {
      setMessage("이메일과 비밀번호를 입력하세요.");
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("회원가입 완료. 이제 로그인하세요.");
      setMode("login");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center text-gray-800">
          {mode === "login" ? "로그인" : "회원가입"}
        </h1>

        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />

        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />

        {message && (
          <p className="text-sm text-red-500">
            {message}
          </p>
        )}

        <button
          onClick={handleAuth}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-lg"
        >
          {mode === "login" ? "로그인" : "회원가입"}
        </button>

        <button
          onClick={() =>
            setMode(mode === "login" ? "signup" : "login")
          }
          className="w-full text-sm text-gray-500"
        >
          {mode === "login"
            ? "회원가입하기"
            : "로그인으로 돌아가기"}
        </button>
      </div>
    </div>
  );
}