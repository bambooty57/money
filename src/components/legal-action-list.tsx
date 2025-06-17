"use client";

import { useEffect, useState } from 'react';
import type { LegalAction } from '@/types/database';

export function LegalActionList() {
  const [actions, setActions] = useState<LegalAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActions() {
      try {
        const response = await fetch('/api/legal-actions');
        if (!response.ok) {
          throw new Error('법적 조치 목록을 불러오는데 실패했습니다.');
        }
        const data = await response.json();
        setActions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
    fetchActions();
  }, []);

  if (loading) {
    return <div className="p-4">로딩 중...</div>;
  }
  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">유형</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">예정일</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">비고</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">등록일</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {actions.map((action) => (
            <tr key={action.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">{action.type}</td>
              <td className="px-6 py-4 whitespace-nowrap">{action.status}</td>
              <td className="px-6 py-4 whitespace-nowrap">{action.due_date ? new Date(action.due_date).toLocaleDateString() : '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap">{action.description || '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap">{new Date(action.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 