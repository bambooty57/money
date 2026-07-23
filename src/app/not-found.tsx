import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-10 border-2 border-red-200 flex flex-col items-center">
        <span className="text-6xl mb-4">❌</span>
        <h1 className="text-3xl font-bold text-red-600 mb-2">페이지를 찾을 수 없습니다</h1>
        <p className="text-lg text-gray-600 mb-4">요청하신 페이지가 존재하지 않거나, 이동되었을 수 있습니다.</p>
        <Link href="/" className="mt-2 px-6 py-3 bg-blue-500 text-white rounded-lg text-xl font-bold shadow hover:bg-blue-600 transition-colors">홈으로 돌아가기</Link>
      </div>
    </div>
  );
} 