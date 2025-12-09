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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // 세션이 제대로 저장되었는지 확인
      if (data.session) {
        console.log('✅ 로그인 성공, 세션 확인:', data.session.user?.email);   

        // 세션이 localStorage에 저장될 시간을 주기 위해 약간 대기
        await new Promise(resolve => setTimeout(resolve, 500));

        // 세션 재확인
        const { data: { session: verifiedSession } } = await supabase.auth.getSession();

        if (verifiedSession) {
          console.log('✅ 세션 검증 완료, 페이지 이동');
          // 완전한 페이지 리로드를 위해 window.location 사용
          window.location.href = "/";
        } else {
          setError("세션 저장에 실패했습니다. 다시 시도해주세요.");
          setLoading(false);
        }
      } else {
        setError("로그인에 실패했습니다. 다시 시도해주세요.");
        setLoading(false);
      }
    } catch (err) {
      console.error('로그인 오류:', err);
      const errorMessage = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.";
      setError(errorMessage);
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