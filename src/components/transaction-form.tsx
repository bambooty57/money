"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { Customer } from '@/types/database';
import { ProductModelTypeDropdown } from './product-model-type-autocomplete'
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert } from './ui/alert';
import { Upload, FileIcon, ImageIcon, Trash2, Download } from 'lucide-react';

interface TransactionFormProps {
  customers: Customer[];
  onSuccess?: () => void;
  transaction?: any; // 수정 대상 거래(있으면 수정 모드)
}

export default function TransactionForm({ customers, onSuccess, transaction }: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [formData, setFormData] = useState({
    customer_id: transaction?.customer_id || '',
    type: transaction?.type || '',
    amount: transaction?.amount?.toString() || '',
    status: transaction?.status || 'unpaid',
    description: transaction?.description || '',
    date: transaction?.date || '',
    due_date: transaction?.due_date || '',
    proofs: [] as File[],
    models_types_id: transaction?.models_types_id || '',
  });

  useEffect(() => {
    if (transaction) {
      setFormData({
        customer_id: transaction.customer_id || '',
        type: transaction.type || '',
        amount: transaction.amount?.toString() || '',
        status: transaction.status || 'unpaid',
        description: transaction.description || '',
        date: transaction.date || '',
        due_date: transaction.due_date || '',
        proofs: [],
        models_types_id: transaction.models_types_id || '',
      });
    }
  }, [transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const supabase = createClient();
      let error;
      if (transaction) {
        // 수정
        const { proofs, date, ...rest } = formData;
        const updatePayload = {
          customer_id: formData.customer_id,
          type: formData.type,
          amount: parseFloat(formData.amount),
          status: formData.status,
          description: formData.description || null,
          models_types_id: formData.models_types_id,
          due_date: formData.due_date || null,
        };
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
          models_types_id: formData.models_types_id,
          due_date: formData.due_date || null,
        };
        ({ error } = await supabase
          .from('transactions')
          .insert(insertPayload));
      }
      if (error) throw error;
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {successMsg && <Alert variant="default">{successMsg}</Alert>}
      {errorMsg && <Alert variant="destructive">{errorMsg}</Alert>}
      <div>
        <label htmlFor="customer_id">고객명<span className="text-red-500">*</span></label>
        <select
          id="customer_id"
          name="customer_id"
          value={formData.customer_id}
          onChange={e => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
          required
          className="w-full border rounded p-2"
        >
          <option value="">고객명을 선택하세요</option>
          {customers.filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <small className="text-gray-500">고객관리에서 등록된 고객만 거래 등록이 가능합니다. (신규 고객은 고객관리에서 먼저 등록)</small>
      </div>

      <div>
        <label htmlFor="type">거래 유형<span className="text-red-500">*</span></label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleChange}
          required
          className="w-full border rounded p-2"
        >
          <option value="">선택하세요</option>
          <option value="새제품 판매">새제품 판매</option>
          <option value="중고제품 판매">중고제품 판매</option>
          <option value="부품판매">부품판매</option>
          <option value="출장">출장</option>
          <option value="운송">운송</option>
          <option value="수리">수리</option>
          <option value="렌탈/임대">렌탈/임대</option>
          <option value="기타">기타</option>
        </select>
      </div>

      <ProductModelTypeDropdown
        selectedId={formData.models_types_id}
        onSelect={(id: string) => setFormData(prev => ({ ...prev, models_types_id: id }))}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700">
          금액
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <input
            type="number"
            value={formData.amount}
            onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
            className="block w-full rounded-md border-gray-300 pl-3 pr-12 focus:border-blue-500 focus:ring-blue-500"
            required
            title="거래 금액을 입력하세요"
            aria-label="거래 금액"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="text-gray-500 sm:text-sm">원</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          거래일자
        </label>
        <input
          type="date"
          value={formData.date}
          onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
          title="거래일자를 입력하세요"
          aria-label="거래일자"
        />
      </div>

      <div>
        <label htmlFor="due_date">지급예정일</label>
        <input
          type="date"
          id="due_date"
          name="due_date"
          value={formData.due_date}
          onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
          className="w-full border rounded p-2"
          required
        />
      </div>

      <div>
        <label htmlFor="description">비고(마크다운 지원)</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={4}
          className="w-full border rounded p-2"
          placeholder="예: *굵게*, [링크](url), - 리스트, 줄바꿈 등 지원"
        />
        <small className="text-gray-500">*굵게*, [링크](url), - 리스트, 줄바꿈 등 마크다운 서식 지원</small>
      </div>

      <div>
        <label htmlFor="proofs">첨부파일(여러 개 선택 가능)</label>
        <FileDropzone files={formData.proofs} onFilesChange={files => setFormData(prev => ({ ...prev, proofs: files }))} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          상태
        </label>
        <select
          value={formData.status}
          onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as 'paid' | 'unpaid' }))}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
          title="거래 상태를 선택하세요"
          aria-label="거래 상태"
        >
          <option value="unpaid">미수</option>
          <option value="paid">완료</option>
        </select>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 text-white rounded-md ${
            loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
          title={loading ? '거래 등록 중...' : (transaction ? '수정하기' : '등록하기')}
        >
          {loading ? '처리중...' : (transaction ? '수정하기' : '등록하기')}
        </Button>
      </div>
    </form>
  );
} 