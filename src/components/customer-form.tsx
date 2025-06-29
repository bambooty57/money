"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ProductModelTypeAutocomplete } from './product-model-type-autocomplete'
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert } from './ui/alert';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

interface CustomerFormProps {
  onSuccess: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  customer?: any;
}

// 카카오 주소검색 타입 선언
declare global {
  interface Window {
    daum?: any;
  }
}

export function CustomerForm({ onSuccess, open, setOpen, customer }: CustomerFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    customer_type: '',
    customer_type_custom: '',
    ssn: '',
    business_name: '',
    business_no: '',
    mobile: '',
    phone: '',
    fax: '',
    address_road: '',
    address_jibun: '',
    zipcode: '',
  });
  const [photos, setPhotos] = useState<(File | { url: string })[]>([]);
  const [addressSearchOpen, setAddressSearchOpen] = useState(false);
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);

  // 정규식
  const mobileRegex = /^\d{3}-\d{3,4}-\d{4}$/;
  const phoneRegex = /^\d{2,3}-\d{3,4}-\d{4}$/;
  const ssnRegex = /^\d{6}-[1-4]\d{6}$/;
  const businessNoRegex = /^\d{3}-\d{2}-\d{5}$/;

  // 사진 input ref 추가
  const photoInputRef = useRef<HTMLInputElement>(null);

  // 파일명에서 한글, 공백, 특수문자 제거
  function sanitizeFileName(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  // 사진 업로드 함수
  async function uploadPhotos(files: File[], customerId: string) {
    const uploaded = [];
    for (const file of files) {
      const safeName = sanitizeFileName(file.name);
      const filePath = `customer_photos/${customerId}/${Date.now()}_${safeName}`;
      const { data, error } = await supabase.storage.from('photos').upload(filePath, file);
      if (error) throw error;
      const { data: publicUrl } = supabase.storage.from('photos').getPublicUrl(filePath);
      // files 테이블에 메타데이터 저장
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          name: safeName,
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
          address_jibun: data.jibunAddress || data.autoJibunAddress || '',
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

  const removePhoto = async (index: number) => {
    const photo = photos[index];
    // 서버에 저장된 사진이면 삭제 API 호출
    if ((photo as any).url && customer && customer.id) {
      if (window.confirm('이 사진을 삭제하시겠습니까?')) {
        // 파일 id를 url에서 추출하거나, files API에서 id를 받아와야 함
        // 간단히 url 전체를 file_id로 가정(실제 id가 필요하면 추가 fetch 필요)
        const res = await fetch(`/api/files?file_id=${encodeURIComponent((photo as any).url)}`, {
          method: 'DELETE',
        });
        if (!res.ok) alert('사진 삭제 실패');
      }
    }
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // 사진 드래그 시작
  const handleDragStart = (index: number) => setDraggedPhotoIndex(index);
  // 사진 드래그 오버
  const handleDragOver = (index: number) => {
    if (draggedPhotoIndex === null || draggedPhotoIndex === index) return;
    setPhotos(prev => {
      const updated = [...prev];
      const [removed] = updated.splice(draggedPhotoIndex, 1);
      updated.splice(index, 0, removed);
      return updated;
    });
    setDraggedPhotoIndex(index);
  };
  // 사진 드래그 종료
  const handleDragEnd = () => setDraggedPhotoIndex(null);

  const handleAddPhotoClick = () => {
    if (photoInputRef.current) photoInputRef.current.click();
  };

  function autoHyphenSSN(value: string) {
    return value
      .replace(/[^0-9]/g, '')
      .replace(/(\d{6})(\d{0,7})/, (m, a, b) => b ? `${a}-${b}` : a)
      .slice(0, 14);
  }

  function autoHyphenPhone(value: string) {
    return value
      .replace(/[^0-9]/g, '')
      .replace(/(\d{2,3})(\d{3,4})(\d{0,4})/, (m, a, b, c) => c ? `${a}-${b}-${c}` : b ? `${a}-${b}` : a)
      .slice(0, 13);
  }

  // customer prop 변경 시 폼 초기화 + 기존 사진 fetch
  useEffect(() => {
    async function fetchExistingPhotos(customerId: string) {
      const res = await fetch(`/api/files?customer_id=${customerId}`);
      const files = await res.json();
      return Array.isArray(files) ? files.map((f: any) => ({ url: f.url })) : [];
    }
    if (customer) {
      setFormData({
        name: customer.name || '',
        customer_type: customer.customer_type || '',
        customer_type_custom: '',
        ssn: customer.ssn || '',
        business_name: customer.business_name || '',
        business_no: customer.business_no || '',
        mobile: customer.mobile || '',
        phone: customer.phone || '',
        fax: customer.fax || '',
        address_road: customer.address_road || '',
        address_jibun: customer.address_jibun || '',
        zipcode: customer.zipcode || '',
      });
      if (customer.id) {
        fetchExistingPhotos(customer.id).then(setPhotos);
      } else {
        setPhotos([]);
      }
    } else {
      setFormData({
        name: '', customer_type: '', customer_type_custom: '', ssn: '', business_name: '', business_no: '', mobile: '', phone: '', fax: '', address_road: '', address_jibun: '', zipcode: '',
      });
      setPhotos([]);
    }
  }, [customer, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 유효성 검사
      if (!formData.name) throw new Error('이름을 입력하세요.');
      if (!formData.customer_type) throw new Error('고객유형을 선택하세요.');
      if (formData.customer_type === '직접입력' && !formData.customer_type_custom) throw new Error('고객유형을 직접입력 시 세부유형을 입력하세요.');
      if (formData.ssn && !ssnRegex.test(formData.ssn)) throw new Error('주민등록번호 형식이 올바르지 않습니다.');
      if (!mobileRegex.test(formData.mobile)) throw new Error('휴대전화 형식이 올바르지 않습니다.');
      if (formData.phone && !phoneRegex.test(formData.phone)) throw new Error('일반전화 형식이 올바르지 않습니다.');
      if (formData.business_no && !businessNoRegex.test(formData.business_no)) throw new Error('사업자번호 형식이 올바르지 않습니다.');
      // 주소 필수
      if (!formData.address_road || !formData.zipcode) throw new Error('주소검색을 완료하세요.');

      // payload 정제: undefined/null → ''
      const rawPayload = {
        ...formData,
        customer_type: formData.customer_type === '직접입력' ? formData.customer_type_custom : formData.customer_type,
      };
      const payload = Object.fromEntries(
        Object.entries(rawPayload).map(([k, v]) => [k, v ?? ''])
      );
      let response, customerResult;
      if (customer && customer.id) {
        // 수정
        response = await fetch(`/api/customers/${customer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // 신규
        response = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (!response.ok) throw new Error(customer ? '고객 수정 실패' : '고객 등록 실패');
      customerResult = await response.json();
      // 사진 업로드: File 객체만 업로드
      const newFiles = photos.filter(p => p instanceof File) as File[];
      if (newFiles.length > 0 && customerResult.id) {
        await uploadPhotos(newFiles, customerResult.id);
      }
      setFormData({ name: '', customer_type: '', customer_type_custom: '', ssn: '', business_name: '', business_no: '', mobile: '', phone: '', fax: '', address_road: '', address_jibun: '', zipcode: '', });
      setPhotos([]);
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      alert(error.message || (customer ? '고객 수정 중 오류 발생' : '고객 등록 중 오류 발생'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby="customer-form-desc">
        <div id="customer-form-desc" className="sr-only">
          고객정보를 등록하거나 수정하는 대화상자입니다. 필수 입력 항목을 확인하세요.
        </div>
        <DialogHeader>
          <DialogTitle>{customer ? '고객 정보 수정' : '신규 고객 등록'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">이름 *</label>
              <input type="text" required value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">고객유형 *</label>
              <select
                value={formData.customer_type}
                onChange={e => setFormData(prev => ({ ...prev, customer_type: e.target.value, customer_type_custom: '' }))}
                className="w-full border rounded px-3 py-2"
                required
                title="고객유형 선택"
              >
                <option value="">선택하세요</option>
                <option value="농민">농민</option>
                <option value="센터">센터</option>
                <option value="대리점">대리점</option>
                <option value="관공서">관공서</option>
                <option value="직접입력">직접입력</option>
              </select>
              {formData.customer_type === '직접입력' && (
                <input
                  type="text"
                  value={formData.customer_type_custom}
                  onChange={e => setFormData(prev => ({ ...prev, customer_type_custom: e.target.value }))}
                  className="w-full border rounded px-3 py-2 mt-2"
                  placeholder="고객유형 직접 입력"
                  required
                />
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">주민등록번호</label>
            <input type="text" value={formData.ssn} onChange={e => setFormData(prev => ({ ...prev, ssn: autoHyphenSSN(e.target.value) }))} className="w-full border rounded px-3 py-2" placeholder="000101-3XXXXXX" title="주민등록번호" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">사업자명</label>
              <input type="text" value={formData.business_name} onChange={e => setFormData(prev => ({ ...prev, business_name: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="사업자명" title="사업자명" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">사업자번호</label>
              <input type="text" value={formData.business_no} onChange={e => setFormData(prev => ({ ...prev, business_no: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="123-45-67890" title="사업자번호" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">휴대전화 *</label>
              <input type="tel" required value={formData.mobile} onChange={e => setFormData(prev => ({ ...prev, mobile: autoHyphenPhone(e.target.value) }))} className="w-full border rounded px-3 py-2" placeholder="000-0000-0000" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">일반전화</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="0000000000" title="일반전화" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">팩스</label>
              <input type="tel" value={formData.fax} onChange={e => setFormData(prev => ({ ...prev, fax: e.target.value }))} className="w-full border rounded px-3 py-2" placeholder="0000000000" title="팩스번호" />
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
          <div className="flex items-center gap-2 mb-1">
            <label className="block text-sm font-medium">사진 (최대 3장, 선택)</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {photos.map((photo, index) => (
                <div
                  key={index}
                  className="relative"
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={e => { e.preventDefault(); handleDragOver(index); }}
                  onDragEnd={handleDragEnd}
                  style={{ opacity: draggedPhotoIndex === index ? 0.5 : 1 }}
                >
                  {'url' in photo ? (
                    <img src={photo.url} alt={`Preview ${index + 1}`} className="w-24 h-20 object-cover rounded border" />
                  ) : (
                    <img src={URL.createObjectURL(photo as File)} alt={`Preview ${index + 1}`} className="w-24 h-20 object-cover rounded border" />
                  )}
                  <button type="button" onClick={() => removePhoto(index)} className="absolute top-1 right-1 bg-white bg-opacity-80 rounded px-1 text-xs text-red-600 border border-red-200">삭제</button>
                </div>
              ))}
              {photos.length < 3 && (
                <button
                  type="button"
                  onClick={handleAddPhotoClick}
                  className="flex items-center justify-center w-24 h-20 border-2 border-dashed border-gray-300 rounded text-3xl text-gray-400 hover:bg-gray-100 focus:outline-none"
                  title="사진 추가"
                >
                  +
                </button>
              )}
            </div>
            <label htmlFor="photo-upload" className="sr-only">사진 업로드</label>
            <input
              id="photo-upload"
              type="file"
              multiple
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
              ref={photoInputRef}
              title="사진 업로드"
              placeholder="사진 파일을 선택하세요"
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" disabled={loading}>{loading ? (customer ? '수정 중...' : '등록 중...') : (customer ? '수정' : '등록')}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 