"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // 이미 로그인되어 있는지 확인
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('✅ 이미 로그인되어 있습니다. 대시보드로 이동합니다.');
          window.location.href = "/";
        }
      } catch (err) {
        console.error('세션 확인 오류:', err);
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, []);

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

  if (checkingSession) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-lg shadow-lg flex flex-col items-center justify-center gap-4">
        <div className="text-2xl">🔍</div>
        <div className="text-xl font-bold text-center">세션 확인 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleLogin} className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg flex flex-col gap-6 border-2 border-blue-200">
        <h2 className="text-2xl font-bold text-center flex items-center justify-center gap-2">
          🔐 로그인
        </h2>
        
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="text-lg font-semibold mb-2 block">📧 이메일</label>
            <input
              id="email"
              type="email"
              placeholder="이메일을 입력하세요"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full text-lg px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
              disabled={loading}
            />
          </div>
          
          <div>
            <label htmlFor="password" className="text-lg font-semibold mb-2 block">🔑 비밀번호</label>
            <input
              id="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full text-lg px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
              disabled={loading}
            />
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border-2 border-red-300 text-red-700 text-lg font-semibold p-4 rounded-lg flex items-center gap-2">
            <span>❌</span>
            <span>{error}</span>
          </div>
        )}
        
        <button 
          type="submit" 
          disabled={loading} 
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xl font-bold py-4 px-6 rounded-lg shadow-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span>⏳</span>
              <span>로그인 중...</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>로그인</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
} 