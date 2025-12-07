"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        // 세션이 저장될 시간을 주기 위해 약간의 지연
        await new Promise(resolve => setTimeout(resolve, 100));
        // 페이지 전체 새로고침으로 세션 쿠키가 확실히 설정되도록 함
        window.location.href = "/";
      } else {
        setError("세션을 가져올 수 없습니다.");
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="max-w-xs mx-auto mt-20 p-6 border rounded-lg shadow-lg flex flex-col gap-4">
      <h2 className="text-xl font-bold text-center">로그인</h2>
      <input
        type="email"
        placeholder="이메일"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="border rounded px-3 py-2"
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        className="border rounded px-3 py-2"
      />
      <button type="submit" disabled={loading} className="bg-blue-600 text-white py-2 rounded font-bold">
        {loading ? "로그인 중..." : "로그인"}
      </button>
      {error && <div className="text-red-500 text-center text-sm">{error}</div>}
    </form>
  );
} 