import Image from "next/image";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">크레딧-노트</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 카드 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">총 미수 잔액</h2>
          <p className="text-2xl font-bold text-red-600">0원</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">미수 고객 수</h2>
          <p className="text-2xl font-bold text-blue-600">0명</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">당월 발생 채권</h2>
          <p className="text-2xl font-bold text-green-600">0원</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">당월 회수액</h2>
          <p className="text-2xl font-bold text-purple-600">0원</p>
        </div>
      </div>

      {/* 미수금 연령 분석 */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">미수금 연령 분석</h2>
        <div className="h-64 flex items-center justify-center text-gray-500">
          차트가 여기에 표시됩니다
        </div>
      </div>

      {/* 오늘의 할 일 */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">오늘의 할 일</h2>
        <div className="space-y-4">
          <div className="p-4 border rounded">
            <h3 className="font-medium">입금 예정일 D-3 이내 고객</h3>
            <p className="text-gray-500 mt-2">데이터가 없습니다</p>
          </div>
          <div className="p-4 border rounded">
            <h3 className="font-medium">오늘부터 연체 시작된 고객</h3>
            <p className="text-gray-500 mt-2">데이터가 없습니다</p>
          </div>
          <div className="p-4 border rounded">
            <h3 className="font-medium">법적 조치 관련 예정일</h3>
            <p className="text-gray-500 mt-2">데이터가 없습니다</p>
          </div>
        </div>
      </div>

      {/* 미수금 상위 5위 고객 */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">미수금 상위 5위 고객</h2>
        <div className="space-y-2">
          <p className="text-gray-500">데이터가 없습니다</p>
        </div>
      </div>

      {/* 최근 활동 로그 */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">최근 활동 로그</h2>
        <div className="space-y-2">
          <p className="text-gray-500">데이터가 없습니다</p>
        </div>
      </div>
    </div>
  );
}
