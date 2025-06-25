"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface CustomerFormProps {
  onSuccess: () => void;
}

// 카카오 주소검색 타입 선언
declare global {
  interface Window {
    daum?: any;
  }
}

export function CustomerForm({ onSuccess }: CustomerFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    isPersonal: false,
    isCorporate: false,
    ssn: '',
    business_name: '',
    business_no: '',
    representative_name: '',
    mobile: '',
    phone: '',
    address_road: '',
    address_jibun: '',
    zipcode: '',
    email: '',
    grade: '일반',
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [addressSearchOpen, setAddressSearchOpen] = useState(false);

  // 정규식
  const mobileRegex = /^\d{3}-\d{3,4}-\d{4}$/;
  const phoneRegex = /^\d{2,3}-\d{3,4}-\d{4}$/;
  const ssnRegex = /^\d{6}-[1-4]\d{6}$/;
  const businessNoRegex = /^\d{3}-\d{2}-\d{5}$/;

  // 사진 업로드 함수
  async function uploadPhotos(files: File[], customerId: string) {
    const uploaded = [];
    for (const file of files) {
      const filePath = `customer_photos/${customerId}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('photos').upload(filePath, file);
      if (error) throw error;
      const { data: publicUrl } = supabase.storage.from('photos').getPublicUrl(filePath);
      // files 테이블에 메타데이터 저장
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          name: file.name,
          url: publicUrl.publicUrl,
          type: file.type,
        }),
      });
      uploaded.push(publicUrl.publicUrl);
    }
    return uploaded;
  }

  // 카카오 주소검색 스크립트 동적 로드
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.daum?.Postcode) {
      const script = document.createElement('script');
      script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // 주소검색 팝업 호출
  function handleAddressSearch() {
    if (!window.daum?.Postcode) {
      alert('카카오 주소검색 스크립트가 아직 로드되지 않았습니다.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: function(data: any) {
        setFormData(prev => ({
          ...prev,
          address_road: data.roadAddress,
          address_jibun: data.jibunAddress,
          zipcode: data.zonecode
        }));
      }
    }).open();
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 3) {
      alert('사진은 최대 3장까지 업로드할 수 있습니다.');
      return;
    }
    setPhotos(prev => [...prev, ...files].slice(0, 3));
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 유효성 검사
      if (!formData.name) throw new Error('이름을 입력하세요.');
      if (!formData.isPersonal && !formData.isCorporate) throw new Error('고객유형을 선택하세요.');
      if (formData.isPersonal && !ssnRegex.test(formData.ssn)) throw new Error('주민등록번호 형식이 올바르지 않습니다.');
      if (!mobileRegex.test(formData.mobile)) throw new Error('휴대전화 형식이 올바르지 않습니다.');
      if (formData.phone && !phoneRegex.test(formData.phone)) throw new Error('일반전화 형식이 올바르지 않습니다.');
      if (formData.business_no && !businessNoRegex.test(formData.business_no)) throw new Error('사업자번호 형식이 올바르지 않습니다.');
      if (photos.length === 0) throw new Error('사진을 1장 이상 첨부하세요.');
      // 주소 필수
      if (!formData.address_road || !formData.zipcode) throw new Error('주소검색을 완료하세요.');

      // 고객 등록
      const payload = {
        ...formData,
        customer_type_multi: [
          formData.isPersonal ? '개인' : null,
          formData.isCorporate ? '법인' : null,
        ].filter(Boolean),
      };
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('고객 등록 실패');
      const customer = await response.json();
      // 사진 업로드
      if (photos.length > 0 && customer.id) {
        await uploadPhotos(photos, customer.id);
      }
      setFormData({
        name: '', isPersonal: false, isCorporate: false, ssn: '', business_name: '', business_no: '', representative_name: '', mobile: '', phone: '', address_road: '', address_jibun: '', zipcode: '', email: '', grade: '일반',
      });
      setPhotos([]);
      setIsOpen(false);
      onSuccess();
    } catch (error: any) {
      alert(error.message || '고객 등록 중 오류 발생');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4">신규 고객 등록</button>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">신규 고객 등록</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">이름 *</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">고객유형 *</label>
                  <div className="flex gap-2">
                    <label><input type="checkbox" checked={formData.isPersonal} onChange={e => setFormData(prev => ({ ...prev, isPersonal: e.target.checked }))} /> 개인</label>
                    <label><input type="checkbox" checked={formData.isCorporate} onChange={e => setFormData(prev => ({ ...prev, isCorporate: e.target.checked }))} /> 법인</label>
                  </div>
                </div>
              </div>
              {formData.isPersonal && (
                <div>
                  <label className="block text-sm font-medium mb-1">주민등록번호 *</label>
                  <input type="text" required value={formData.ssn} onChange={e => setFormData(prev => ({ ...prev, ssn: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="000101-3XXXXXX" />
                </div>
              )}
              {(formData.isCorporate || formData.isPersonal) && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">사업자명</label>
                    <input type="text" value={formData.business_name} onChange={e => setFormData(prev => ({ ...prev, business_name: e.target.value }))} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">사업자번호</label>
                    <input type="text" value={formData.business_no} onChange={e => setFormData(prev => ({ ...prev, business_no: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="123-45-67890" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">대표자명</label>
                    <input type="text" value={formData.representative_name} onChange={e => setFormData(prev => ({ ...prev, representative_name: e.target.value }))} className="w-full border rounded px-3 py-2" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">휴대전화 *</label>
                  <input type="tel" required value={formData.mobile} onChange={e => setFormData(prev => ({ ...prev, mobile: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="000-0000-0000" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">일반전화</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="000-000-0000" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">주소 *</label>
                <div className="flex gap-2 items-center mb-1">
                  <button type="button" onClick={handleAddressSearch} className="px-2 py-1 bg-blue-600 text-white rounded">주소검색</button>
                  <span className="text-xs text-gray-500">도로명/지번 중 한가지만 선택해도 모두 자동입력</span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="address_road">도로명주소</label>
                  <input id="address_road" type="text" value={formData.address_road} onChange={e => setFormData(prev => ({ ...prev, address_road: e.target.value }))} className="w-full border rounded px-3 py-2 mb-1" placeholder="도로명주소" title="도로명주소" />
                  <label className="block text-sm font-medium mb-1" htmlFor="address_jibun">지번주소</label>
                  <input id="address_jibun" type="text" value={formData.address_jibun} onChange={e => setFormData(prev => ({ ...prev, address_jibun: e.target.value }))} className="w-full border rounded px-3 py-2 mb-1" placeholder="지번주소" title="지번주소" />
                  <label className="block text-sm font-medium mb-1" htmlFor="zipcode">우편번호</label>
                  <input id="zipcode" type="text" value={formData.zipcode} onChange={e => setFormData(prev => ({ ...prev, zipcode: e.target.value }))} className="w-full border rounded px-3 py-2 mb-1" placeholder="우편번호" title="우편번호" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="photo-upload">사진 (최대 3장) *</label>
                <input id="photo-upload" type="file" multiple accept="image/*" onChange={handlePhotoChange} className="w-full border rounded px-3 py-2" title="사진 업로드" placeholder="사진 파일을 선택하세요" />
                {photos.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img src={URL.createObjectURL(photo)} alt={`Preview ${index + 1}`} className="w-full h-20 object-cover rounded" />
                        <button type="button" onClick={() => removePhoto(index)} className="absolute top-1 right-1 bg-white bg-opacity-80 rounded-full px-2 py-1 text-xs">삭제</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="email">이메일</label>
                  <input id="email" type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} className="w-full border rounded px-3 py-2 mb-1" placeholder="이메일" title="이메일" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="grade">등급</label>
                  <select id="grade" value={formData.grade} onChange={e => setFormData(prev => ({ ...prev, grade: e.target.value }))} className="w-full border rounded px-3 py-2 mb-1" title="등급 선택">
                    <option value="">등급 선택</option>
                    <option value="일반">일반</option>
                    <option value="우수">우수</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" disabled={loading}>{loading ? '등록 중...' : '등록'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
} 