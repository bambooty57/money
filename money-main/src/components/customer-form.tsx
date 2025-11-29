"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
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
    memo: '',
    prospects: [] as Array<{
      device_type: string;
      model: string;
      current_model: string;
    }>,
  });
  const [photos, setPhotos] = useState<(File | { id: string; url: string })[]>([]);
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
    if ((photo as any).id && (photo as any).url && customer && customer.id) {
      if (window.confirm('이 사진을 삭제하시겠습니까?')) {
        try {
          console.log('🗑️ 사진 삭제 시도 - ID:', (photo as any).id);
          
          // Supabase 세션에서 토큰 가져오기
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;

          if (!token) {
            alert('인증이 필요합니다. 다시 로그인해주세요.');
            return;
          }
          
          // 실제 파일 ID로 삭제 API 호출
          const res = await fetch(`/api/files?file_id=${(photo as any).id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (!res.ok) {
            const errorText = await res.text();
            console.error('❌ 사진 삭제 API 실패:', res.status, errorText);
            alert('사진 삭제 실패: ' + errorText);
            return; // 실패 시 UI에서 제거하지 않음
          }
          
          console.log('✅ 사진 삭제 성공');
          
        } catch (error) {
          console.error('❌ 사진 삭제 중 오류:', error);
          alert('사진 삭제 중 오류가 발생했습니다.');
          return; // 실패 시 UI에서 제거하지 않음
        }
      } else {
        return; // 사용자가 취소 시 삭제하지 않음
      }
    }
    
    // 성공적으로 삭제되었거나 새로 추가한 파일인 경우 UI에서 제거
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
      return Array.isArray(files) ? files.map((f: any) => ({ id: f.id, url: f.url })) : [];
    }

    async function fetchProspectData(customerId: string) {
      const prospectsRes = await fetch(`/api/prospects?customer_id=${customerId}`);
      const prospectsData = await prospectsRes.json();
      if (prospectsData.data && prospectsData.data.length > 0) {
        // 모든 가망기종 정보를 배열로 변환
        const prospects = (prospectsData.data || []).map((p: any) => {
          // 현재보유 모델 텍스트 생성
          let currentModel = '';
          if (p.models_types) {
            currentModel = `${p.models_types.model} / ${p.models_types.type}`;
          } else if (p.current_device_model) {
            currentModel = p.current_device_model;
          }
          
          // 가망모델 처리 (배열이면 첫 번째만, 문자열이면 그대로)
          let model = '';
          if (p.prospect_device_model) {
            if (Array.isArray(p.prospect_device_model) && p.prospect_device_model.length > 0) {
              model = p.prospect_device_model[0]; // 첫 번째 모델만 사용
            } else if (typeof p.prospect_device_model === 'string') {
              model = p.prospect_device_model;
            }
          }
          
          return {
            device_type: p.prospect_device_type || '',
            model: model,
            current_model: currentModel,
          };
        });
        
        setFormData(prev => ({
          ...prev,
          prospects: prospects || [],
        }));
      }
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
        memo: customer.memo || '',
        prospects: [],
      });
      
      // 가망고객 정보 로드
      if (customer.id) {
        fetchProspectData(customer.id);
        fetchExistingPhotos(customer.id).then(setPhotos);
      } else {
        setPhotos([]);
      }
    } else {
      setFormData({
        name: '', customer_type: '', customer_type_custom: '', ssn: '', business_name: '', business_no: '', mobile: '', phone: '', fax: '', address_road: '', address_jibun: '', zipcode: '', memo: '',
        prospects: [],
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

      // Supabase 세션에서 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
      }

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
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload),
        });
      } else {
        // 신규
        response = await fetch('/api/customers', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload),
        });
      }
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${customer ? '고객 수정' : '고객 등록'} 실패: ${errorText}`);
      }
      customerResult = await response.json();
      // 사진 업로드: File 객체만 업로드
      const newFiles = photos.filter(p => p instanceof File) as File[];
      if (newFiles.length > 0 && customerResult.id) {
        await uploadPhotos(newFiles, customerResult.id);
      }
      
      // 가망고객 정보 저장/업데이트 (여러 개 저장)
      if (customerResult.id && formData.prospects && formData.prospects.length > 0) {
        try {
          // 기존 가망고객 정보 삭제 (편집 시)
          if (customer && customer.id) {
            await fetch(`/api/prospects?customer_id=${customerResult.id}`, {
              method: 'DELETE',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
            }).catch(() => {}); // 삭제 실패는 무시 (없을 수도 있음)
          }
          
          // 각 가망기종 정보를 개별 레코드로 저장
          for (const prospect of (formData.prospects || [])) {
            if (prospect.device_type) {
              await fetch('/api/prospects', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  customer_id: customerResult.id,
                  prospect_device_type: prospect.device_type,
                  prospect_device_model: prospect.model ? [prospect.model] : null,
                  current_device_model: prospect.current_model || null,
                  current_device_model_id: null,
                }),
              });
            }
          }
        } catch (prospectError) {
          console.error('가망고객 정보 저장 실패:', prospectError);
          // 가망고객 정보 저장 실패는 경고만 하고 계속 진행
        }
      } else if (customerResult.id && customer && customer.id) {
        // 가망기종이 비어있고 수정 모드인 경우, 기존 가망고객 정보 삭제
        try {
          await fetch(`/api/prospects?customer_id=${customerResult.id}`, {
            method: 'DELETE',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
          }).catch(() => {}); // 삭제 실패는 무시
        } catch (prospectError) {
          console.error('가망고객 정보 삭제 실패:', prospectError);
        }
      }
      
      setFormData({ 
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
        memo: '',
        prospects: [] 
      });
      setPhotos([]);
      
      // 성공 콜백을 먼저 호출하여 데이터 새로고침
      onSuccess();
      
      // 약간의 지연 후 모달 닫기 (데이터 업데이트가 완료되도록)
      setTimeout(() => {
        setOpen(false);
      }, 100);
    } catch (error: any) {
      alert(error.message || (customer ? '고객 수정 중 오류 발생' : '고객 등록 중 오류 발생'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby="customer-form-desc" className="max-h-[80vh] overflow-y-auto">
        <div id="customer-form-desc" className="sr-only">
          고객정보를 등록하거나 수정하는 대화상자입니다. 필수 입력 항목을 확인하세요.
        </div>
        <DialogHeader>
          <DialogTitle>{customer ? '고객 정보 수정' : '신규 고객 등록'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-8 w-full max-w-6xl mx-auto">
          {/* 이름/고객유형 */}
          <div className="bg-blue-50 rounded-lg p-8 border-2 border-blue-200 shadow-lg flex flex-col gap-4 w-full max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row gap-4 w-full">
              <div className="flex-1">
                <label className="text-xl font-bold mb-2 flex items-center gap-2">👤 이름 *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full border-2 border-blue-300 rounded-lg px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200" title="이름" placeholder="이름을 입력하세요" />
              </div>
              <div className="flex-1">
                <label className="text-xl font-bold mb-2 flex items-center gap-2">🏷️ 고객유형 *</label>
                <select
                  value={formData.customer_type}
                  onChange={e => setFormData(prev => ({ ...prev, customer_type: e.target.value, customer_type_custom: '' }))}
                  className="w-full border-2 border-blue-300 rounded-lg px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
                    className="w-full border-2 border-blue-300 rounded-lg px-4 py-3 text-lg mt-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="고객유형 직접 입력"
                    required
                  />
                )}
              </div>
            </div>
          </div>
          {/* 주민등록번호 */}
          <div className="bg-green-50 rounded-lg p-8 border-2 border-green-200 shadow-lg flex flex-col gap-2 w-full max-w-5xl mx-auto">
            <label className="text-xl font-bold mb-2 flex items-center gap-2">🆔 주민등록번호</label>
            <input type="text" value={formData.ssn} onChange={e => setFormData(prev => ({ ...prev, ssn: autoHyphenSSN(e.target.value) }))} className="w-full border-2 border-green-300 rounded-lg px-4 py-3 text-lg focus:border-green-500 focus:ring-2 focus:ring-green-200" placeholder="000101-3XXXXXX" title="주민등록번호" />
          </div>
          {/* 사업자명/번호 */}
          <div className="bg-orange-50 rounded-lg p-8 border-2 border-orange-200 shadow-lg flex flex-col gap-6 w-full max-w-5xl mx-auto">
            <div className="flex flex-col gap-6 w-full">
              <div>
                <label className="text-xl font-bold mb-2 flex items-center gap-2">🏢 사업자명</label>
                <input type="text" value={formData.business_name} onChange={e => setFormData(prev => ({ ...prev, business_name: e.target.value }))} className="w-full border-2 border-orange-300 rounded-lg px-4 py-3 text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 mb-2" placeholder="사업자명" title="사업자명" />
              </div>
              <div>
                <label className="text-xl font-bold mb-2 flex items-center gap-2"># 사업자번호</label>
                <input type="text" value={formData.business_no} onChange={e => setFormData(prev => ({ ...prev, business_no: e.target.value }))} className="w-full border-2 border-orange-300 rounded-lg px-4 py-3 text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200" placeholder="123-45-67890" title="사업자번호" />
              </div>
            </div>
          </div>
          {/* 연락처 */}
          <div className="bg-purple-50 rounded-lg p-8 border-2 border-purple-200 shadow-lg flex flex-col gap-6 w-full max-w-5xl mx-auto">
            <div className="flex flex-col gap-6 w-full">
              <div>
                <label className="text-xl font-bold mb-2 flex items-center gap-2">📱 휴대전화 *</label>
                <input type="tel" required value={formData.mobile} onChange={e => setFormData(prev => ({ ...prev, mobile: autoHyphenPhone(e.target.value) }))} className="w-full border-2 border-purple-300 rounded-lg px-4 py-3 text-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 mb-2" placeholder="000-0000-0000" />
              </div>
              <div>
                <label className="text-xl font-bold mb-2 flex items-center gap-2">☎️ 일반전화</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} className="w-full border-2 border-purple-300 rounded-lg px-4 py-3 text-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 mb-2" placeholder="0000000000" title="일반전화" />
              </div>
              <div>
                <label className="text-xl font-bold mb-2 flex items-center gap-2">📠 팩스</label>
                <input type="tel" value={formData.fax} onChange={e => setFormData(prev => ({ ...prev, fax: e.target.value }))} className="w-full border-2 border-purple-300 rounded-lg px-4 py-3 text-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200" placeholder="0000000000" title="팩스번호" />
              </div>
            </div>
          </div>
          {/* 주소 */}
          <div className="bg-yellow-50 rounded-lg p-8 border-2 border-yellow-200 shadow-lg flex flex-col gap-4 w-full max-w-5xl mx-auto">
            <label className="text-xl font-bold mb-2 flex items-center gap-2">🏠 주소 *</label>
            <div className="flex gap-2 items-center mb-1">
              <button type="button" onClick={handleAddressSearch} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-lg font-bold hover:bg-blue-700">주소검색</button>
              <span className="text-base text-gray-500">도로명/지번 중 한가지만 선택해도 모두 자동입력</span>
            </div>
            <label className="text-lg font-semibold mb-1" htmlFor="address_road">도로명주소</label>
            <input id="address_road" type="text" value={formData.address_road} onChange={e => setFormData(prev => ({ ...prev, address_road: e.target.value }))} className="w-full border-2 border-yellow-300 rounded-lg px-4 py-3 text-lg mb-1 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200" placeholder="도로명주소" title="도로명주소" />
            <label className="text-lg font-semibold mb-1" htmlFor="address_jibun">지번주소</label>
            <input id="address_jibun" type="text" value={formData.address_jibun} onChange={e => setFormData(prev => ({ ...prev, address_jibun: e.target.value }))} className="w-full border-2 border-yellow-300 rounded-lg px-4 py-3 text-lg mb-1 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200" placeholder="지번주소" title="지번주소" />
            <label className="text-lg font-semibold mb-1" htmlFor="zipcode">우편번호</label>
            <input id="zipcode" type="text" value={formData.zipcode} onChange={e => setFormData(prev => ({ ...prev, zipcode: e.target.value }))} className="w-full border-2 border-yellow-300 rounded-lg px-4 py-3 text-lg mb-1 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200" placeholder="우편번호" title="우편번호" />
          </div>
          {/* 메모 */}
          <div className="bg-indigo-50 rounded-lg p-8 border-2 border-indigo-200 shadow-lg flex flex-col gap-4 w-full max-w-5xl mx-auto">
            <label className="text-xl font-bold mb-2 flex items-center gap-2">📝 메모 <span className="text-gray-500 text-base font-normal">(선택사항)</span></label>
            <textarea
              value={formData.memo}
              onChange={e => setFormData(prev => ({ ...prev, memo: e.target.value }))}
              className="w-full border-2 border-indigo-300 rounded-lg px-4 py-3 text-lg min-h-[120px] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 resize-y"
              placeholder="고객에 대한 메모를 입력하세요..."
              title="메모"
            />
          </div>
          {/* 가망기종 정보 */}
          <div className="bg-orange-50 rounded-lg p-8 border-2 border-orange-200 shadow-lg flex flex-col gap-4 w-full max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xl font-bold flex items-center gap-2">🚜 가망기종 정보 <span className="text-gray-500 text-base font-normal">(선택사항)</span></label>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    prospects: [...(prev.prospects || []), { device_type: '', model: '', current_model: '' }]
                  }));
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-lg font-bold"
                title="가망기종 정보 추가"
              >
                ➕ 가망기종 추가
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {(formData.prospects || []).map((prospect, index) => (
                <div key={index} className="bg-white rounded-lg p-6 border-2 border-orange-300 shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-orange-800">가망기종 정보 {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => {
                        const newProspects = (formData.prospects || []).filter((_, i) => i !== index);
                        setFormData(prev => ({ ...prev, prospects: newProspects }));
                      }}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-base font-bold"
                      title="삭제"
                    >
                      삭제
                    </button>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-lg font-semibold mb-2 flex items-center gap-2">가망기종</label>
                      <select
                        value={prospect.device_type}
                        onChange={e => {
                          const newProspects = [...(formData.prospects || [])];
                          newProspects[index] = { ...newProspects[index], device_type: e.target.value };
                          setFormData(prev => ({ ...prev, prospects: newProspects }));
                        }}
                        className="w-full border-2 border-orange-300 rounded-lg px-4 py-3 text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                        title="가망기종 선택"
                      >
                        <option value="">선택하세요</option>
                        <option value="트랙터">트랙터</option>
                        <option value="콤바인">콤바인</option>
                        <option value="이앙기">이앙기</option>
                        <option value="작업기">작업기</option>
                        <option value="기타">기타</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-lg font-semibold mb-2 flex items-center gap-2">가망모델</label>
                      <input
                        type="text"
                        value={prospect.model}
                        onChange={e => {
                          const newProspects = [...(formData.prospects || [])];
                          newProspects[index] = { ...newProspects[index], model: e.target.value };
                          setFormData(prev => ({ ...prev, prospects: newProspects }));
                        }}
                        className="w-full border-2 border-orange-300 rounded-lg px-4 py-3 text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                        placeholder="가망모델 입력 (예: L47H, ER575K 등)"
                        title="가망모델 입력"
                      />
                    </div>
                    <div>
                      <label className="text-lg font-semibold mb-2 flex items-center gap-2">현재보유 모델</label>
                      <input
                        type="text"
                        value={prospect.current_model}
                        onChange={e => {
                          const newProspects = [...(formData.prospects || [])];
                          newProspects[index] = { ...newProspects[index], current_model: e.target.value };
                          setFormData(prev => ({ ...prev, prospects: newProspects }));
                        }}
                        className="w-full border-2 border-orange-300 rounded-lg px-4 py-3 text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                        placeholder="현재보유 모델을 입력하세요 (예: L45SV / 트랙터)"
                        title="현재보유 모델 입력"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {(!formData.prospects || formData.prospects.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  가망기종 정보가 없습니다. &quot;➕ 가망기종 추가&quot; 버튼을 클릭하여 추가하세요.
                </div>
              )}
            </div>
          </div>
          {/* 사진 */}
          <div className="bg-indigo-50 rounded-lg p-8 border-2 border-indigo-200 shadow-lg flex flex-col gap-4 w-full max-w-5xl mx-auto">
            <label className="text-xl font-bold mb-2 flex items-center gap-2">🖼️ 사진 (최대 3장, 선택)</label>
            <div className="mt-2 grid grid-cols-3 gap-4">
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
                    <img src={photo.url} alt={`Preview ${index + 1}`} className="w-28 h-24 object-cover rounded border-2 border-indigo-300" />
                  ) : (
                    <img src={URL.createObjectURL(photo as File)} alt={`Preview ${index + 1}`} className="w-28 h-24 object-cover rounded border-2 border-indigo-300" />
                  )}
                  <button type="button" onClick={() => removePhoto(index)} className="absolute top-1 right-1 bg-white bg-opacity-80 rounded px-2 text-base text-red-600 border border-red-200 font-bold">삭제</button>
                </div>
              ))}
              {photos.length < 3 && (
                <button
                  type="button"
                  onClick={handleAddPhotoClick}
                  className="flex items-center justify-center w-28 h-24 border-2 border-dashed border-indigo-300 rounded text-3xl text-indigo-400 hover:bg-indigo-100 focus:outline-none"
                  title="사진 추가"
                >
                  +
                </button>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoChange}
              title="사진 업로드"
            />
          </div>
          {/* 등록 버튼 */}
          <div className="flex justify-center mt-4 w-full">
            <Button
              type="submit"
              disabled={loading}
              className={`w-full max-w-xs text-2xl px-8 py-4 flex items-center gap-2 rounded-lg shadow-lg ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'} text-white font-bold transition-colors duration-200`}
              title={loading ? '처리 중입니다. 잠시만 기다려주세요.' : (customer ? '수정하기' : '등록하기')}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  처리중...
                </>
              ) : (
                customer ? (<><span>📝</span> 수정하기</>) : (<><span>➕</span> 등록하기</>)
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 