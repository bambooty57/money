"use client";

import { useState } from 'react';
import type { Customer } from '@/types/database';

interface CustomerListProps {
  customers: Customer[];
}

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
    
    return sortDirection === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
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
            <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('business_number')}>
              사업자번호 {sortField === 'business_number' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('representative_name')}>
              대표자 {sortField === 'representative_name' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('phone')}>
              연락처 {sortField === 'phone' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('grade')}>
              등급 {sortField === 'grade' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th className="px-6 py-3 border-b cursor-pointer" onClick={() => handleSort('credit_limit')}>
              여신한도 {sortField === 'credit_limit' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedCustomers.map(customer => (
            <tr key={customer.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 border-b">{customer.name}</td>
              <td className="px-6 py-4 border-b">{customer.business_number}</td>
              <td className="px-6 py-4 border-b">{customer.representative_name}</td>
              <td className="px-6 py-4 border-b">{customer.phone}</td>
              <td className="px-6 py-4 border-b">{customer.grade}</td>
              <td className="px-6 py-4 border-b">
                {customer.credit_limit ? customer.credit_limit.toLocaleString() : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 