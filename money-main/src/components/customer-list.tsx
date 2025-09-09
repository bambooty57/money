"use client";

import { useEffect, useState, useRef } from 'react';
import type { Database } from '@/types/database';

type CustomerBase = Database['public']['Tables']['customers']['Row'];
type Customer = CustomerBase & { grade?: string | null };

interface CustomerListProps {
  customers: Customer[];
  onEdit?: (customer: Customer) => void;
  onDelete?: (id: string) => void;
}

const openKakaoMap = (address: string) => {
  const kakaoMapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(address)}`;
  window.open(kakaoMapUrl, '_blank');
};

export function CustomerList({ customers, onEdit, onDelete }: CustomerListProps) {
  const [sortField, setSortField] = useState<keyof Customer>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [photosMap, setPhotosMap] = useState<Record<string, { url: string }[]>>({});
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const [filter, setFilter] = useState({
    customerType: [],
    address: '',
    minUnpaid: '',
    maxUnpaid: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    // 고객별 사진(files) 비동기 로딩
    async function fetchPhotos() {
      const map: Record<string, { url: string }[]> = {};
      for (const customer of customers) {
        if (!customer.id) continue;
        const res = await fetch(`/api/files?customer_id=${customer.id}`);
        const files = await res.json();
        map[customer.id] = Array.isArray(files) ? files.map((f: any) => ({ url: f.url })) : [];
      }
      setPhotosMap(map);
    }
    fetchPhotos();
  }, [customers]);

  const sortedCustomers = [...customers].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    if (aValue === null) return sortDirection === 'asc' ? 1 : -1;
    if (bValue === null) return sortDirection === 'asc' ? -1 : 1;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    if (Array.isArray(aValue) && Array.isArray(bValue)) {
      return sortDirection === 'asc'
        ? aValue.length - bValue.length
        : bValue.length - aValue.length;
    }
    return 0;
  });

  const handleSort = (field: keyof Customer) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleExcelDownload = async () => {
    const res = await fetch('/api/customers/export');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    if (downloadRef.current) {
      downloadRef.current.href = url;
      downloadRef.current.download = 'customers.xlsx';
      downloadRef.current.click();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, multiple, options } = e.target as HTMLSelectElement;
    if (multiple) {
      // 다중 선택(select)
      const selected = Array.from(options).filter(o => o.selected).map(o => o.value);
      setFilter(prev => ({ ...prev, [name]: selected }));
    } else {
      setFilter(prev => ({ ...prev, [name]: value }));
    }
    // TODO: fetchCustomers(filter) 등으로 실제 필터링 적용
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        <label className="sr-only" htmlFor="filter-customerType">고객유형</label>
        <select id="filter-customerType" name="customerType" multiple className="border rounded px-2 py-1" value={filter.customerType} onChange={handleFilterChange} title="고객유형 선택">
          <option value="개인">개인</option>
          <option value="법인">법인</option>
        </select>
        <label className="sr-only" htmlFor="filter-address">주소</label>
        <input id="filter-address" name="address" type="text" className="border rounded px-2 py-1" placeholder="주소" title="주소" value={filter.address} onChange={handleFilterChange} />
        <label className="sr-only" htmlFor="filter-minUnpaid">최소 미수금</label>
        <input 
          id="filter-minUnpaid" 
          name="minUnpaid" 
          type="number" 
          className="border rounded px-2 py-1" 
          placeholder="최소 미수금" 
          title="최소 미수금 (마우스 스크롤 비활성화됨)" 
          value={filter.minUnpaid} 
          onChange={handleFilterChange} 
          onWheel={(e) => {
            // 마우스 스크롤로 인한 숫자 변경 방지
            e.preventDefault();
          }}
          onKeyDown={(e) => {
            // 위/아래 화살표 키로 인한 숫자 변경 방지
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
            }
          }}
        />
        <label className="sr-only" htmlFor="filter-maxUnpaid">최대 미수금</label>
        <input 
          id="filter-maxUnpaid" 
          name="maxUnpaid" 
          type="number" 
          className="border rounded px-2 py-1" 
          placeholder="최대 미수금" 
          title="최대 미수금 (마우스 스크롤 비활성화됨)" 
          value={filter.maxUnpaid} 
          onChange={handleFilterChange} 
          onWheel={(e) => {
            // 마우스 스크롤로 인한 숫자 변경 방지
            e.preventDefault();
          }}
          onKeyDown={(e) => {
            // 위/아래 화살표 키로 인한 숫자 변경 방지
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
            }
          }}
        />
        <label className="sr-only" htmlFor="filter-startDate">등록 시작일</label>
        <input id="filter-startDate" name="startDate" type="date" className="border rounded px-2 py-1" title="등록 시작일" value={filter.startDate} onChange={handleFilterChange} />
        <label className="sr-only" htmlFor="filter-endDate">등록 종료일</label>
        <input id="filter-endDate" name="endDate" type="date" className="border rounded px-2 py-1" title="등록 종료일" value={filter.endDate} onChange={handleFilterChange} />
      </div>
      <div className="flex justify-end mb-2">
        <button onClick={handleExcelDownload} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">엑셀 다운로드</button>
        <a ref={downloadRef} style={{ display: 'none' }} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('name')}>
                거래처명 {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('customer_type')}>
                고객유형 {sortField === 'customer_type' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('business_no')}>
                사업자번호 {sortField === 'business_no' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 border-b">휴대전화</th>
              <th className="px-6 py-3 border-b">일반전화</th>
              <th className="px-6 py-3 border-b">사업자명</th>
              <th className="px-6 py-3 border-b">대표자명</th>
              <th className="px-6 py-3 border-b">주민등록번호</th>
              <th className="px-6 py-3 border-b">주소</th>
              <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('grade')}>
                등급 {sortField === 'grade' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 border-b">사진</th>
              <th className="px-6 py-3 border-b">작업</th>
            </tr>
          </thead>
          <tbody>
            {sortedCustomers.map(customer => (
              <tr key={customer.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 border-b">{customer.name}</td>
                <td className="px-6 py-4 border-b">{Array.isArray(customer.customer_type_multi) && customer.customer_type_multi.length > 0 ? customer.customer_type_multi.join(', ') : customer.customer_type || '-'}</td>
                <td className="px-6 py-4 border-b">{customer.business_no}</td>
                <td className="px-6 py-4 border-b">{customer.mobile}</td>
                <td className="px-6 py-4 border-b">{customer.phone}</td>
                <td className="px-6 py-4 border-b">{customer.business_name}</td>
                <td className="px-6 py-4 border-b">{customer.representative_name}</td>
                <td className="px-6 py-4 border-b">{customer.ssn}</td>
                <td className="px-6 py-4 border-b">{(customer.address_road || customer.address_jibun || customer.zipcode) ? (
                  <button
                    onClick={() => openKakaoMap(customer.address_road || customer.address_jibun || '')}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {[customer.address_road, customer.address_jibun, customer.zipcode].filter(Boolean).join(' / ')}
                  </button>
                ) : '-'}</td>
                <td className="px-6 py-4 border-b">{customer.grade}</td>
                <td className="px-6 py-4 border-b">
                  {photosMap[customer.id] ? `${photosMap[customer.id].length}장` : '0장'}
                </td>
                <td className="px-6 py-4 border-b">
                  <button
                    className="text-green-600 hover:text-green-900 mr-2"
                    onClick={() => onEdit && onEdit(customer)}
                    title="수정"
                  >✏️</button>
                  <button
                    className="text-red-600 hover:text-red-900"
                    onClick={() => onDelete && onDelete(customer.id)}
                    title="삭제"
                  >🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 