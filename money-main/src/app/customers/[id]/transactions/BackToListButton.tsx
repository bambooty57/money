"use client";
import { useRouter } from 'next/navigation';

export default function BackToListButton() {
  const router = useRouter();
  return (
    <button
      className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
      onClick={() => router.push('/transactions')}
    >
      ← 거래관리로 돌아가기
    </button>
  );
} 