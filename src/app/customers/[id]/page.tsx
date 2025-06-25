"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [summary, setSummary] = useState<any>(null);
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
        .eq('id', id)
        .single();

      if (data) {
        // 사진(files) 별도 조회
        const filesRes = await fetch(`/api/files?customer_id=${id}`);
        const files = await filesRes.json();
        setCustomer({
          ...data,
          legalActions: data.legal_actions || [],
          photos: Array.isArray(files) ? files.map((f: any) => ({ url: f.url })) : [],
        } as CustomerDetails);
      }
    }
    
    fetchCustomerDetails();
  }, [id]);

  useEffect(() => {
    async function fetchSummary() {
      const res = await fetch(`/api/customers/${id}/summary`);
      const data = await res.json();
      setSummary(data);
    }
    fetchSummary();
  }, [id]);

  if (!customer) return <div>로딩 중...</div>;
  if (!summary) return <div>로딩 중...</div>;

  return (
    <main className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">고객 상세: {id}</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-white p-4 rounded shadow">
            <div className="text-gray-500 text-sm">총 거래금액</div>
            <div className="text-xl font-bold">{summary.total_amount.toLocaleString()}원</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-gray-500 text-sm">총 입금합계</div>
            <div className="text-xl font-bold text-green-700">{summary.total_paid.toLocaleString()}원</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-gray-500 text-sm">총 미수금</div>
            <div className="text-xl font-bold text-red-700">{summary.total_unpaid.toLocaleString()}원</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-gray-500 text-sm">변제비율</div>
            <div className="text-xl font-bold">{summary.total_ratio}%</div>
          </div>
        </div>
      </div>
      <div className="border-b mb-4">
        <nav className="flex space-x-4">
          <button onClick={() => setActiveTab('profile')} className={`py-2 px-4 ${activeTab === 'profile' ? 'border-b-2 border-blue-500' : ''}`}>기본 정보</button>
          <button onClick={() => setActiveTab('transactions')} className={`py-2 px-4 ${activeTab === 'transactions' ? 'border-b-2 border-blue-500' : ''}`}>거래/변제 내역</button>
        </nav>
      </div>
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
              <p>고객유형: {Array.isArray(customer.customer_type_multi) && customer.customer_type_multi.length > 0 ? customer.customer_type_multi.join(', ') : customer.customer_type || '-'}</p>
              <p>사업자명: {customer.business_name}</p>
              <p>사업자번호: {customer.business_no}</p>
              <p>대표자명: {customer.representative_name}</p>
              <p>주민등록번호: {customer.ssn}</p>
            </div>
            <div>
              <h3 className="font-semibold">연락처</h3>
              <p>휴대전화: {customer.mobile}</p>
              <p>일반전화: {customer.phone}</p>
              <p>이메일: {customer.email}</p>
              <p>주소: {(customer.address_road || customer.address_jibun || customer.zipcode) ? (
                <button 
                  onClick={() => openKakaoMap(customer.address_road || customer.address_jibun || '')}
                  className="text-blue-600 hover:text-blue-800 underline ml-1"
                >
                  {[customer.address_road, customer.address_jibun, customer.zipcode].filter(Boolean).join(' / ')}
                </button>
              ) : '-'}</p>
            </div>
            <div>
              <h3 className="font-semibold">기타</h3>
              <p>등급: {customer.grade}</p>
              <p>등록일: {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '-'}</p>
              <p>수정일: {customer.updated_at ? new Date(customer.updated_at).toLocaleDateString() : '-'}</p>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            {summary.transactions.map((tx: any) => (
              <div key={tx.id} className="border rounded-lg p-4 mb-4 bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
                  <div>
                    <div className="font-bold text-lg">{tx.type} ({tx.detail_type || '-'})</div>
                    <div className="text-sm text-gray-500">{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '-'}</div>
                  </div>
                  <div className="flex gap-4 mt-2 md:mt-0">
                    <div>금액: <span className="font-bold">{tx.amount?.toLocaleString()}원</span></div>
                    <div>입금: <span className="text-green-700 font-bold">{tx.paid_amount?.toLocaleString()}원</span></div>
                    <div>미수: <span className="text-red-700 font-bold">{tx.unpaid_amount?.toLocaleString()}원</span></div>
                    <div>변제비율: <span className="font-bold">{tx.paid_ratio}%</span></div>
                  </div>
                </div>
                {/* 변제내역 타임라인 */}
                <div className="mt-2">
                  <div className="font-semibold mb-1">변제내역</div>
                  {tx.payments && tx.payments.length > 0 ? (
                    <ul className="divide-y">
                      {tx.payments.map((p: any) => (
                        <li key={p.id} className="py-1 flex flex-col md:flex-row md:items-center md:gap-4">
                          <span>{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '-'}</span>
                          <span>{p.amount?.toLocaleString()}원</span>
                          <span>{p.method}</span>
                          <span>입금자: {p.payer_name || '-'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <div className="text-gray-400">변제내역 없음</div>}
                </div>
                {/* 증빙자료 */}
                <div className="mt-2">
                  <div className="font-semibold mb-1">증빙자료</div>
                  {tx.files && tx.files.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {tx.files.map((f: any) => (
                        <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">{f.name || '파일'}</a>
                      ))}
                    </div>
                  ) : <div className="text-gray-400">증빙자료 없음</div>}
                </div>
                {/* 거래 상세내역(기계명, 수리부위 등) 필요시 추가 */}
              </div>
            ))}
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