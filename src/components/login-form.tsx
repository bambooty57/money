"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      if (signInError) {
        console.error('❌ 로그인 오류:', signInError.message);
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // 세션이 제대로 저장되었는지 확인
      if (data.session) {
        console.log('✅ 로그인 성공, 세션 확인:', data.session.user?.email);

        // 쿠키가 설정될 시간을 주기 위해 약간 대기
        await new Promise(resolve => setTimeout(resolve, 300));

        // 세션 재확인
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          console.log('✅ 사용자 검증 완료, 페이지 이동');
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
    <form onSubmit={handleLogin} className="max-w-md mx-auto mt-20 p-8 border-2 rounded-xl shadow-xl flex flex-col gap-6 bg-white">
      <h2 className="text-2xl font-bold text-center text-blue-700">🔐 로그인</h2>
      
      <div className="flex flex-col gap-2">
        <label className="text-lg font-semibold text-gray-700">이메일</label>
        <input
          type="email"
          placeholder="이메일을 입력하세요"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
        />
      </div>
      
      <div className="flex flex-col gap-2">
        <label className="text-lg font-semibold text-gray-700">비밀번호</label>
        <input
          type="password"
          placeholder="비밀번호를 입력하세요"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="border-2 border-gray-300 rounded-lg px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
        />
      </div>
      
      <button 
        type="submit" 
        disabled={loading} 
        className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? "🔄 로그인 중..." : "✅ 로그인"}
      </button>
      
      {error && (
        <div className="text-red-600 text-center text-lg font-semibold bg-red-50 p-3 rounded-lg border border-red-200">
          ⚠️ {error}
        </div>
      )}
    </form>
  );
}
