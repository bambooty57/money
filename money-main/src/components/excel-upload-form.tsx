'use client';

import { useState } from 'react';
import { Upload, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Alert } from './ui/alert';

export function ExcelUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('성공적으로 업로드되었습니다.');
        // TODO: 성공 후 목록 새로고침
        setFile(null); // 성공 후 파일 선택 초기화
      } else {
        const errorData = await response.json();
        let errorMessage = "알 수 없는 오류가 발생했습니다.";
        
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        if (errorData.errors && Array.isArray(errorData.errors)) {
          errorMessage += `\n\n상세 오류:\n- ${errorData.errors.join('\n- ')}`;
        }
    
        alert(`업로드 실패:\n${errorMessage}`);
      }
    } catch (error) {
      console.error('An unexpected error occurred:', error);
      alert('예상치 못한 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">엑셀/CSV 파일 일괄 등록</h2>
      <div className="space-y-4">
        <a
          href="/api/download-template"
          download="upload_template.csv"
          className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
        >
          <Download className="mr-2 h-4 w-4" />
          CSV 양식 다운로드
        </a>
        
        <form onSubmit={handleSubmit}>
          <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 mb-2">
            다운로드 받은 양식에 데이터를 채워 업로드하세요.
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500"
                >
                  <span>파일 선택</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".xlsx, .xls, .csv" />
                </label>
              </div>
              <p className="text-xs text-gray-500">{file ? file.name : 'XLSX, XLS, CSV 파일'}</p>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={!file || isUploading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:bg-gray-400"
            >
              {isUploading ? '업로드 중...' : '업로드'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 