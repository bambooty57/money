"use client";

import { useState } from 'react';

interface CustomerFormProps {
  onSuccess: () => void;
}

const CUSTOMER_TYPES = ['일반농민', '센터등 사업자', '관공서', '기타'];

export function CustomerForm({ onSuccess }: CustomerFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    customerType: '일반농민',
    businessNo: '',
    phone: '',
    email: '',
    address: '',
    grade: '일반',
  });
  const [photos, setPhotos] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create customer');
      }

      // 폼 초기화
      setFormData({
        name: '',
        customerType: '일반농민',
        businessNo: '',
        phone: '',
        email: '',
        address: '',
        grade: '일반',
      });
      setPhotos([]);
      setIsOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('채무자 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 5) {
      alert('사진은 최대 5장까지 업로드할 수 있습니다.');
      return;
    }
    setPhotos(prev => [...prev, ...files]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4"
      >
        새 채무자 등록
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">새 채무자 등록</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">이름 *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">채무자 유형 *</label>
                  <select
                    required
                    value={formData.customerType}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerType: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                  >
                    {CUSTOMER_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">사업자번호</label>
                  <input
                    type="text"
                    value={formData.businessNo}
                    onChange={(e) => setFormData(prev => ({ ...prev, businessNo: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">전화번호 *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">이메일</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">등급</label>
                  <select
                    value={formData.grade}
                    onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="우수">우수</option>
                    <option value="일반">일반</option>
                    <option value="주의">주의</option>
                    <option value="요주의">요주의</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">주소</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  placeholder="주소를 입력하면 카카오맵으로 확인할 수 있습니다"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">사진 (최대 5장)</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="w-full border rounded px-3 py-2"
                />
                {photos.length > 0 && (
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? '등록 중...' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
} 