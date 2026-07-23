"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { ProductModelTypeDropdown } from './product-model-type-autocomplete'
import { useState as useReactState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert } from './ui/alert';
import { Upload, FileIcon, ImageIcon, Trash2, Download } from 'lucide-react';
import { sanitizeFileName } from '@/lib/utils';
import { useRefreshContext } from '@/lib/refresh-context';

interface TransactionFormProps {
  customers?: Customer[];
  onSuccess?: () => void;
  transaction?: any; // 수정 대상 거래(있으면 수정 모드)
  refresh?: number;
  onPaymentSuccess?: () => void;
  defaultCustomerId?: string;
}

type Customer = Database['public']['Tables']['customers']['Row'];

export default function TransactionForm({ customers, onSuccess, transaction, refresh, onPaymentSuccess, defaultCustomerId }: TransactionFormProps) {
  const [allCustomers, setAllCustomers] = useState<Customer[]>(customers || []);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [formData, setFormData] = useState({
    customer_id: transaction?.customer_id || defaultCustomerId || '',
    type: transaction?.type || '',
    amount: transaction?.amount?.toString() || '',
    status: transaction?.status || 'unpaid',
    description: transaction?.description || '',
    date: transaction?.date || '',
    due_date: transaction?.due_date || '',
    proofs: [] as File[],
    models_types_id: transaction?.models_types_id || '',
  });

  const { triggerRefresh } = useRefreshContext();
  const inputRef = useRef<HTMLInputElement>(null);

  // 모든 고객 목록 가져오기 (신규 거래 등록용)
  useEffect(() => {
    if (!customers) {
      fetch('/api/customers?page=1&pageSize=1000')
        .then(res => res.json())
        .then(data => setAllCustomers(data.data || []))
        .catch(() => {/* 고객 목록 로드 실패 시 무시 */});
    }
  }, [customers]);

  // 기종/형식명 전체 목록 fetch (ProductModelTypeDropdown과 동일하게)
  const [modelTypeOptions, setModelTypeOptions] = useReactState<{ id: string; model: string; type: string }[]>([]);
  useEffect(() => {
    fetch('/api/models-types')
      .then(res => res.json())
      .then(data => setModelTypeOptions(data || []));
  }, [refresh]);

  useEffect(() => {
    if (!transaction || modelTypeOptions.length === 0) return;

    // 다양한 필드에서 id 추출 시도
    let models_types_id =
      transaction.models_types_id ||
      transaction.models_types?.id ||
      '';

    // model/type으로도 fallback
    const found = modelTypeOptions.find(mt => mt.id === models_types_id);
    if (!found && (transaction.model || transaction.models_types?.model) && (transaction.model_type || transaction.models_types?.type)) {
      const byName = modelTypeOptions.find(
        mt =>
          mt.model === (transaction.model || transaction.models_types?.model) &&
          mt.type === (transaction.model_type || transaction.models_types?.type)
      );
      models_types_id = byName?.id || '';
    }
    if (models_types_id && !modelTypeOptions.find(mt => mt.id === models_types_id)) {
      models_types_id = '';
    }
    setFormData(prev => ({
      ...prev,
      customer_id: transaction.customer_id || '',
      type: transaction.type || '',
      amount: transaction.amount?.toString() || '',
      status: transaction.status || 'unpaid',
      description: transaction.description || '',
      date: transaction.date ? String(transaction.date).slice(0, 10) : '',
      due_date: transaction.due_date ? String(transaction.due_date).slice(0, 10) : '',
      proofs: [],
      models_types_id,
    }));
    if (transaction.date) setCustomerSearch(allCustomers.find(c => c.id === transaction.customer_id)?.name || '');
  }, [transaction, allCustomers, modelTypeOptions]);

  const handleFileUpload = async (files: File[], transactionId: string) => {
    for (const file of files) {
      const safeName = sanitizeFileName(file.name);
      const path = `proofs/${transactionId}/${safeName}`;
      // Supabase Storage 업로드
      const { error: uploadError } = await supabase.storage.from('photos').upload(path, file);
      if (uploadError) throw uploadError;
      // files 테이블 메타데이터 저장
      const { error: metaError } = await supabase.from('files').insert({
        name: safeName,
        type: file.type,
        url: path,
        transaction_id: transactionId,
      });
      if (metaError) throw metaError;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    // 고객 선택 필수 체크
    if (!formData.customer_id) {
      setErrorMsg('고객을 반드시 선택해야 합니다.');
      setLoading(false);
      return;
    }
    try {
      let error;
      let txId = transaction?.id;
      if (transaction) {
        // 수정
        const { proofs, date, ...rest } = formData;
        const updatePayload = {
          customer_id: formData.customer_id,
          type: formData.type,
          amount: formData.amount !== '' ? parseFloat(formData.amount) : undefined,
          status: formData.status,
          description: formData.description || null,
          models_types_id: formData.models_types_id !== '' ? formData.models_types_id : undefined,
          due_date: formData.due_date !== '' ? formData.due_date : undefined,
          created_at: formData.date !== '' ? formData.date : undefined,
        };
        console.log('거래 수정 PATCH payload:', updatePayload);
        ({ error } = await supabase
          .from('transactions')
          .update(updatePayload)
          .eq('id', transaction.id));
      } else {
        // 등록
        const { proofs, date, ...rest } = formData;
        const insertPayload = {
          customer_id: formData.customer_id,
          type: formData.type,
          amount: parseFloat(formData.amount),
          status: formData.status,
          description: formData.description || null,
          models_types_id: formData.models_types_id !== '' ? formData.models_types_id : null,
          due_date: formData.due_date || null,
          created_at: formData.date || undefined,
        };
        const { data: inserted, error: insertError } = await supabase
          .from('transactions')
          .insert(insertPayload)
          .select('id')
          .single();
        if (insertError) throw insertError;
        txId = inserted.id;
      }
      if (error) throw error;
      // 파일 업로드 및 메타데이터 저장
      if (formData.proofs.length > 0 && txId) {
        await handleFileUpload(formData.proofs, txId);
      }
      setSuccessMsg(transaction ? '거래 수정이 완료되었습니다.' : '거래 등록이 완료되었습니다.');
      if (!transaction) {
        setFormData({
          customer_id: '',
          type: '',
          amount: '',
          status: 'unpaid',
          description: '',
          date: '',
          due_date: '',
          proofs: [],
          models_types_id: '',
        });
      }
      if (onSuccess) onSuccess();
      triggerRefresh(); // 거래 등록/수정 성공 시 새로고침
    } catch (error: any) {
      setErrorMsg(error.message || '거래 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 파일 첨부 드롭존/리스트 UI
  function FileDropzone({ files, onFilesChange }: { files: File[]; onFilesChange: (files: File[]) => void }) {
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const dropped = Array.from(e.dataTransfer.files);
      onFilesChange([...files, ...dropped].slice(0, 5));
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        onFilesChange([...files, ...Array.from(e.target.files)].slice(0, 5));
      }
    };
    return (
      <div>
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer bg-gray-50 hover:bg-blue-50 mb-2"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => document.getElementById('file-upload-input')?.click()}
        >
          <Upload className="mx-auto h-8 w-8 text-blue-400 mb-2" />
          <div className="text-gray-600">여기로 파일을 드래그하거나 <span className="underline text-blue-600">클릭</span>하여 첨부</div>
          <div className="text-xs text-gray-400 mt-1">최대 5개, 파일당 10MB</div>
          <input
            id="file-upload-input"
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,application/pdf"
            title="첨부파일 선택"
            placeholder="첨부할 파일을 선택하세요"
          />
        </div>
        <div className="space-y-2">
          {files.map((file, idx) => (
            <div key={file.name + idx} className="flex items-center bg-white rounded shadow-sm px-2 py-1">
              {file.type.startsWith('image') ? (
                <img src={URL.createObjectURL(file)} alt={file.name} className="w-8 h-8 object-cover rounded mr-2" />
              ) : (
                <FileIcon className="w-6 h-6 text-gray-400 mr-2" />
              )}
              <span className="flex-1 truncate text-sm">{file.name}</span>
              <span className="text-xs text-gray-400 ml-2">{(file.size/1024).toFixed(1)}KB</span>
              <Button variant="ghost" size="icon" type="button" onClick={e => { e.stopPropagation(); onFilesChange(files.filter((_, i) => i !== idx)); }}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
              <Button variant="ghost" size="icon" type="button" onClick={e => { e.stopPropagation(); window.open(URL.createObjectURL(file)); }}>
                <Download className="w-4 h-4 text-blue-500" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, type: e.target.value }));
  };

  // 고객명 입력 UI 교체: 수동 검색 기능
  const [customerSearch, setCustomerSearch] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  
  const handleCustomerSearch = () => {
    if (customerSearch.trim().length === 0) {
      setFilteredCustomers([]);
      return;
    }
    setFilteredCustomers(
      allCustomers.filter(c =>
        c.name.includes(customerSearch) ||
        (c.mobile && c.mobile.replace(/-/g, '').includes(customerSearch.replace(/-/g, '')))
      ).slice(0, 20)
    );
  };

  // Enter 키로도 검색 가능하도록
  const handleCustomerKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCustomerSearch();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-8 w-full max-w-3xl mx-auto">
      {successMsg && <Alert variant="default" className="text-xl font-bold flex items-center gap-2 bg-green-50 border-green-300 text-green-700 p-4 rounded-lg shadow-lg mb-4"><span>✅</span>{successMsg}</Alert>}
      {errorMsg && <Alert variant="destructive" className="text-xl font-bold flex items-center gap-2 bg-red-50 border-red-300 text-red-700 p-4 rounded-lg shadow-lg mb-4"><span>❌</span>{errorMsg}</Alert>}
      {/* 고객명 */}
      <div className="bg-blue-50 rounded-lg p-8 border-2 border-blue-200 shadow-lg flex flex-col gap-2 w-full max-w-2xl mx-auto">
        <label htmlFor="customer_id" className="text-xl font-bold flex items-center gap-2">👤 고객명<span className="text-red-500">*</span></label>
        <div className="relative w-full max-w-xs">
          <input
            ref={inputRef}
            id="customer_id"
            name="customer_id"
            type="text"
            className="border rounded px-4 py-3 text-xl min-w-[200px] w-full focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            placeholder="고객명/전화번호로 검색"
            value={
              (transaction || defaultCustomerId)
                ? (allCustomers.find(c => c.id === formData.customer_id)?.name || '')
                : (customerSearch !== '' ? customerSearch : (allCustomers.find(c => c.id === formData.customer_id)?.name || ''))
            }
            onChange={transaction || defaultCustomerId
              ? undefined
              : e => {
                  setCustomerSearch(e.target.value);
                  setFormData(prev => ({ ...prev, customer_id: '' }));
                }
            }
            onKeyPress={handleCustomerKeyPress}
            readOnly={!!transaction || !!defaultCustomerId}
            autoComplete="off"
            style={{ fontSize: '1.25rem' }}
            required
            title="고객명 또는 전화번호로 검색"
          />
          <Button 
            onClick={handleCustomerSearch}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white px-4 py-2 rounded text-lg font-bold hover:bg-blue-700"
          >
            🔍 검색
          </Button>
          {/* 드롭다운은 등록 모드(신규)일 때만 표시 */}
          {!transaction && filteredCustomers.length > 0 && (
            <ul className="absolute left-0 right-0 bg-white border rounded shadow-lg z-10 mt-1 max-h-72 overflow-y-auto text-lg">
              {filteredCustomers.map(c => (
                <li
                  key={c.id}
                  className="px-4 py-3 hover:bg-blue-100 cursor-pointer flex justify-between items-center"
                  onMouseDown={e => {
                    e.preventDefault(); // blur 방지
                    setFormData(prev => ({ ...prev, customer_id: c.id }));
                    setCustomerSearch('');
                    setFilteredCustomers([]);
                  }}
                >
                  <span className="font-bold">{c.name}</span>
                  <span className="text-gray-500 text-base ml-2">{c.mobile}</span>
                </li>
              ))}
            </ul>
          )}
          {!transaction && filteredCustomers.length === 0 && customerSearch.trim().length > 0 && (
            <div className="absolute left-0 right-0 bg-white border rounded shadow-lg z-10 mt-1 px-4 py-3 text-gray-500 text-lg">검색 결과 없음</div>
          )}
        </div>
        <small className="text-blue-600 text-base mt-1">고객관리에서 등록된 고객만 거래 등록이 가능합니다. (신규 고객은 고객관리에서 먼저 등록)</small>
      </div>
      {/* 거래유형 */}
      <div className="bg-purple-50 rounded-lg p-8 border-2 border-purple-200 shadow-lg flex flex-col gap-2 w-full max-w-2xl mx-auto">
        <label htmlFor="type" className="text-xl font-bold flex items-center gap-2">📝 거래 유형<span className="text-red-500">*</span></label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleChange}
          required
          className="text-lg px-4 py-3 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
        >
          <option value="">선택하세요</option>
          <option value="새제품 판매">새제품 판매</option>
          <option value="중고제품 판매">중고제품 판매</option>
          <option value="부품판매">부품판매</option>
          <option value="출장">출장</option>
          <option value="운송">운송</option>
          <option value="수리">수리</option>
          <option value="렌탈/임대">렌탈/임대</option>
          <option value="보조금">보조금</option>
          <option value="기타">기타</option>
        </select>
      </div>
      {/* 기종/형식명 */}
      <div className="bg-orange-50 rounded-lg p-8 border-2 border-orange-200 shadow-lg flex flex-col gap-2 w-full max-w-2xl mx-auto">
        <label className="text-xl font-bold flex items-center gap-2">🚜 기종/형식명 <span className="text-gray-500 text-base font-normal">(선택사항)</span></label>
        <ProductModelTypeDropdown
          selectedId={String(formData.models_types_id || '')}
          onSelect={(id: string) => setFormData(prev => ({ ...prev, models_types_id: id }))}
          refresh={refresh}
        />
      </div>
      {/* 금액 */}
      <div className="bg-green-50 rounded-lg p-8 border-2 border-green-200 shadow-lg flex flex-col gap-2 w-full max-w-2xl mx-auto">
        <label className="text-xl font-bold flex items-center gap-2">💰 금액</label>
        <div className="relative rounded-md shadow-sm">
          <input
            type="number"
            value={formData.amount}
            onChange={e => {
              const value = e.target.value;
              setFormData(prev => ({
                ...prev,
                amount: value === '' ? '' : Math.round(Number(value)).toString()
              }));
            }}
            onWheel={(e) => {
              // 마우스 스크롤로 인한 숫자 변경 방지
              e.preventDefault();
              e.currentTarget.blur(); // 스크롤 시 포커스 해제
              // 포커스가 있을 때만 스크롤 허용하려면 아래 코드 사용
              // if (document.activeElement !== e.target) {
              //   e.preventDefault();
              // }
            }}
            onKeyDown={(e) => {
              // 위/아래 화살표 키로 인한 숫자 변경 방지 (선택사항)
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
              }
            }}
            className="block w-full rounded-lg border-2 border-green-300 px-4 py-3 text-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
            required
            title="거래 금액을 입력하세요 (마우스 스크롤 비활성화됨)"
            aria-label="거래 금액"
            placeholder="예: 1000000"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="text-green-700 text-xl font-bold">원</span>
          </div>
        </div>
        <small className="text-green-600 text-base mt-1">
          ⚠️ 마우스 스크롤로 인한 실수 방지를 위해 스크롤 기능이 비활성화되어 있습니다.
        </small>
      </div>
      {/* 거래일자 */}
      <div className="bg-green-50 rounded-lg p-8 border-2 border-green-200 shadow-lg flex flex-col gap-2 w-full max-w-2xl mx-auto">
        <label className="text-xl font-bold flex items-center gap-2">📅 거래일자</label>
        <input
          type="date"
          value={formData.date ? String(formData.date).slice(0, 10) : ''}
          onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
          className="rounded-lg border-2 border-green-300 px-4 py-3 text-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
          required
          title="거래일자를 입력하세요"
          aria-label="거래일자"
        />
      </div>
      {/* 지급예정일 */}
      <div className="bg-yellow-50 rounded-lg p-8 border-2 border-yellow-200 shadow-lg flex flex-col gap-2 w-full max-w-2xl mx-auto">
        <label htmlFor="due_date" className="text-xl font-bold flex items-center gap-2">📆 지급예정일</label>
        <input
          type="date"
          id="due_date"
          name="due_date"
          value={formData.due_date ? String(formData.due_date).slice(0, 10) : ''}
          onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
          className="rounded-lg border-2 border-yellow-300 px-4 py-3 text-lg focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200"
          required
        />
      </div>
      {/* 비고 */}
      <div className="bg-orange-50 rounded-lg p-8 border-2 border-orange-200 shadow-lg flex flex-col gap-2 w-full max-w-2xl mx-auto">
        <label htmlFor="description" className="text-xl font-bold flex items-center gap-2">📝 비고(마크다운 지원)</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={4}
          className="w-full rounded-lg border-2 border-orange-300 px-4 py-3 text-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
          placeholder="예: *굵게*, [링크](url), - 리스트, 줄바꿈 등 지원"
        />
        <small className="text-orange-600 text-base mt-1">*굵게*, [링크](url), - 리스트, 줄바꿈 등 마크다운 서식 지원</small>
      </div>
      {/* 첨부파일 */}
      <div className="bg-orange-50 rounded-lg p-8 border-2 border-orange-200 shadow-lg flex flex-col gap-2 w-full max-w-2xl mx-auto">
        <label htmlFor="proofs" className="text-xl font-bold flex items-center gap-2">📤 첨부파일(여러 개 선택 가능)</label>
        <FileDropzone files={formData.proofs} onFilesChange={files => setFormData(prev => ({ ...prev, proofs: files }))} />
      </div>
      {/* 상태 */}
      <div className="bg-purple-50 rounded-lg p-8 border-2 border-purple-200 shadow-lg flex flex-col gap-2 w-full max-w-2xl mx-auto">
        <label className="text-xl font-bold flex items-center gap-2">📊 상태</label>
        <select
          value={formData.status}
          onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as 'paid' | 'unpaid' }))}
          className="rounded-lg border-2 border-purple-300 px-4 py-3 text-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
          required
          title="거래 상태를 선택하세요"
          aria-label="거래 상태"
        >
          <option value="unpaid">미수</option>
          <option value="paid">완료</option>
        </select>
      </div>
      {/* 등록 버튼 */}
      <div className="flex justify-center mt-4 w-full">
        <Button
          type="submit"
          disabled={loading}
          className={`w-full max-w-xs text-2xl px-8 py-4 flex items-center gap-2 rounded-lg shadow-lg ${loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white font-bold transition-colors duration-200`}
          title={loading ? '거래 등록 중...' : (transaction ? '수정하기' : '등록하기')}
        >
          {loading ? '처리중...' : (transaction ? (<><span>📝</span> 수정하기</>) : (<><span>➕</span> 등록하기</>))}
        </Button>
        <Button
          type="button"
          className="w-full max-w-xs text-2xl px-8 py-4 flex items-center gap-2 rounded-lg shadow-lg bg-gray-400 hover:bg-gray-500 text-white font-bold transition-colors duration-200 ml-4"
          onClick={() => { if (onSuccess) onSuccess(); }}
          title="취소하기"
        >
          취소하기
        </Button>
      </div>
    </form>
  );
} 