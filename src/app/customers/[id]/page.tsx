"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import type { Customer, Transaction, LegalAction } from '@/types/database';

interface CustomerDetails extends Customer {
  transactions: Transaction[];
  legalActions: LegalAction[];
}

const openKakaoMap = (address: string) => {
  const kakaoMapUrl = `https://map.kakao.com/link/search/${encodeURIComponent(address)}`;
  window.open(kakaoMapUrl, '_blank');
};

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'transactions' | 'legal' | 'files'>('profile');
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    async function fetchCustomerDetails() {
      const supabase = createClient();
      
      // 고객 정보와 관련 데이터를 한 번에 조회
      const { data } = await supabase
        .from('customers')
        .select(`
          *,
          transactions (*),
          legal_actions (*)
        `)
        .eq('id', params.id)
        .single();

      if (data) {
        setCustomer(data as CustomerDetails);
      }
    }
    
    fetchCustomerDetails();
  }, [params.id]);

  if (!customer) return <div>로딩 중...</div>;

  return (
    <main className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        <p className="text-gray-600">{customer.business_number}</p>
      </div>

      {/* 탭 메뉴 */}
      <div className="border-b mb-4">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-4 ${activeTab === 'profile' ? 'border-b-2 border-blue-500' : ''}`}
          >
            기본 정보
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`py-2 px-4 ${activeTab === 'transactions' ? 'border-b-2 border-blue-500' : ''}`}
          >
            거래 내역
          </button>
          <button
            onClick={() => setActiveTab('legal')}
            className={`py-2 px-4 ${activeTab === 'legal' ? 'border-b-2 border-blue-500' : ''}`}
          >
            법적 조치
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`py-2 px-4 ${activeTab === 'files' ? 'border-b-2 border-blue-500' : ''}`}
          >
            첨부 파일
          </button>
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="bg-white rounded-lg shadow p-4">
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* 사진 갤러리 */}
            {customer.photos && customer.photos.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">사진</h3>
                <div className="bg-gray-100 rounded-lg p-4">
                  {/* 메인 사진 */}
                  <div className="text-center mb-4">
                    <img
                      src={customer.photos?.[currentPhotoIndex]?.url || ''}
                      alt={`${customer.name} 사진 ${currentPhotoIndex + 1}`}
                      className="max-w-full max-h-96 rounded-lg mx-auto cursor-pointer"
                      onClick={() => customer.photos?.[currentPhotoIndex]?.url && window.open(customer.photos[currentPhotoIndex].url, '_blank')}
                    />
                  </div>
                  
                  {/* 사진 네비게이션 */}
                  <div className="flex justify-center space-x-2 mb-4">
                    <button
                      onClick={() => setCurrentPhotoIndex(prev => 
                        prev > 0 ? prev - 1 : (customer.photos?.length || 1) - 1
                      )}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      ← 이전
                    </button>
                    <span className="px-3 py-1 bg-gray-200 rounded">
                      {currentPhotoIndex + 1} / {customer.photos?.length || 0}
                    </span>
                    <button
                      onClick={() => setCurrentPhotoIndex(prev => 
                        prev < (customer.photos?.length || 1) - 1 ? prev + 1 : 0
                      )}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      다음 →
                    </button>
                  </div>
                  
                  {/* 썸네일 */}
                  <div className="flex justify-center space-x-2">
                    {customer.photos?.map((photo, index) => (
                      <img
                        key={index}
                        src={photo.url}
                        alt={`썸네일 ${index + 1}`}
                        className={`w-16 h-16 rounded object-cover cursor-pointer border-2 ${
                          index === currentPhotoIndex ? 'border-blue-500' : 'border-gray-300'
                        }`}
                        onClick={() => setCurrentPhotoIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <h3 className="font-semibold">기본 정보</h3>
              <p>채무자 유형: {customer.customer_type}</p>
              <p>사업자번호: {customer.business_number}</p>
              <p>대표자명: {customer.representative_name}</p>
            </div>
            <div>
              <h3 className="font-semibold">연락처</h3>
              <p>전화: {customer.phone}</p>
              <p>이메일: {customer.email}</p>
              <p>주소: {customer.address ? (
                <button 
                  onClick={() => openKakaoMap(customer.address!)}
                  className="text-blue-600 hover:text-blue-800 underline ml-1"
                >
                  {customer.address}
                </button>
              ) : '-'}</p>
            </div>
            <div>
              <h3 className="font-semibold">거래 정보</h3>
              <p>거래처 등급: {customer.grade}</p>
              <p>등록일: {new Date(customer.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">날짜</th>
                  <th className="text-left p-2">구분</th>
                  <th className="text-right p-2">금액</th>
                  <th className="text-center p-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {customer.transactions.map(tx => (
                  <tr key={tx.id} className="border-b">
                    <td className="p-2">{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td className="p-2">{tx.type}</td>
                    <td className="p-2 text-right">{tx.amount.toLocaleString()}원</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-1 rounded text-sm ${
                        tx.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {tx.status === 'paid' ? '완료' : '미납'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'legal' && (
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">날짜</th>
                  <th className="text-left p-2">조치 유형</th>
                  <th className="text-left p-2">내용</th>
                  <th className="text-center p-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {customer.legalActions.map(action => (
                  <tr key={action.id} className="border-b">
                    <td className="p-2">{new Date(action.created_at).toLocaleDateString()}</td>
                    <td className="p-2">{action.type}</td>
                    <td className="p-2">{action.description}</td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-1 rounded text-sm ${
                        action.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {action.status === 'completed' ? '완료' : '진행중'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <p className="text-gray-500">
                파일을 드래그하여 업로드하거나
                <button className="text-blue-500 underline ml-1">
                  파일 선택
                </button>
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">업로드된 파일</h3>
              <p className="text-gray-500">아직 업로드된 파일이 없습니다.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
} 