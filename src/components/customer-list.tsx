"use client";

import { useState } from 'react';
import type { Customer } from '@/types/database';

interface CustomerListProps {
  customers: Customer[];
}

const openKakaoMap = (address: string) => {
  const kakaoMapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(address)}`;
  window.open(kakaoMapUrl, '_blank');
};

export function CustomerList({ customers }: CustomerListProps) {
  const [sortField, setSortField] = useState<keyof Customer>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
    
    // Handle array fields (like photos)
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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('name')}>
              거래처명 {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('customer_type')}>
              채무자유형 {sortField === 'customer_type' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('business_number')}>
              사업자번호 {sortField === 'business_number' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('phone')}>
              연락처 {sortField === 'phone' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th className="px-6 py-3 border-b">
              주소
            </th>
            <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('grade')}>
              등급 {sortField === 'grade' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th className="px-6 py-3 border-b">
              사진
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedCustomers.map(customer => (
            <tr key={customer.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 border-b">{customer.name}</td>
              <td className="px-6 py-4 border-b">{customer.customer_type}</td>
              <td className="px-6 py-4 border-b">{customer.business_number}</td>
              <td className="px-6 py-4 border-b">{customer.phone}</td>
              <td className="px-6 py-4 border-b">
                {customer.address ? (
                  <button 
                    onClick={() => openKakaoMap(customer.address!)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {customer.address}
                  </button>
                ) : '-'}
              </td>
              <td className="px-6 py-4 border-b">{customer.grade}</td>
              <td className="px-6 py-4 border-b">
                {customer.photos && customer.photos.length > 0 ? (
                  <div className="flex space-x-1">
                    {customer.photos.slice(0, 3).map((photo, index) => (
                      <img
                        key={index}
                        src={photo.url}
                        alt={`${customer.name} 사진 ${index + 1}`}
                        className="w-8 h-8 rounded object-cover cursor-pointer hover:opacity-80"
                        onClick={() => window.open(photo.url, '_blank')}
                      />
                    ))}
                    {customer.photos.length > 3 && (
                      <span className="text-sm text-gray-500">+{customer.photos.length - 3}</span>
                    )}
                  </div>
                ) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 