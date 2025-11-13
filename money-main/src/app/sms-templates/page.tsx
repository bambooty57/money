"use client";

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import type { SmsTemplateCategory } from '@/types/sms';

interface SmsTemplate {
  id: string;
  category: string;
  key: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

export default function SmsTemplatesPage() {
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    category: '' as SmsTemplateCategory | '',
    key: '',
    content: ''
  });
  const [error, setError] = useState('');

  const categories: SmsTemplateCategory[] = [
    '미수금 독촉',
    '상환/입금 안내',
    '분할납부/약정',
    '법적 조치/최종',
    '감사/일상',
    '기타'
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sms-templates');
      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        setTemplates(result.data || []);
      }
    } catch (err) {
      setError('템플릿을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.category || !formData.key || !formData.content) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/sms-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        setShowAddForm(false);
        setFormData({ category: '', key: '', content: '' });
        setError('');
        loadTemplates();
      }
    } catch (err) {
      setError('템플릿 추가에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 템플릿을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sms-templates?id=${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        setError('');
        loadTemplates();
      }
    } catch (err) {
      setError('템플릿 삭제에 실패했습니다.');
    }
  };

  const handleEdit = (template: SmsTemplate) => {
    setEditingId(template.id);
    setFormData({
      category: template.category as SmsTemplateCategory,
      key: template.key,
      content: template.content
    });
    setShowAddForm(false);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !formData.category || !formData.key || !formData.content) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/sms-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          ...formData
        })
      });

      const result = await response.json();
      if (result.error) {
        setError(result.error);
      } else {
        setEditingId(null);
        setFormData({ category: '', key: '', content: '' });
        setError('');
        loadTemplates();
      }
    } catch (err) {
      setError('템플릿 수정에 실패했습니다.');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowAddForm(false);
    setFormData({ category: '', key: '', content: '' });
    setError('');
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, SmsTemplate[]>);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">💬 SMS 메시지 템플릿 관리</h1>
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingId(null);
              setFormData({ category: '', key: '', content: '' });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            템플릿 추가
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 추가/수정 폼 */}
        {(showAddForm || editingId) && (
          <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              {editingId ? '템플릿 수정' : '템플릿 추가'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">카테고리</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as SmsTemplateCategory })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">선택하세요</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">템플릿 키 (고유 식별자)</label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="예: 구보다_새템플릿"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  disabled={!!editingId}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">메시지 내용</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="메시지 내용을 입력하세요. {고객명}, {미수금}, {거래건수} 등의 변수를 사용할 수 있습니다."
                  rows={6}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <div className="mt-2 text-sm text-gray-500">
                  사용 가능한 변수: {'{고객명}'}, {'{미수금}'}, {'{거래건수}'}, {'{납부기한}'}, {'{분할금액}'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={editingId ? handleSaveEdit : handleAdd}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Save size={18} />
                  {editingId ? '저장' : '추가'}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <X size={18} />
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 템플릿 목록 */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">로딩 중...</div>
        ) : (
          <div className="space-y-6">
            {categories.map((category) => {
              const categoryTemplates = groupedTemplates[category] || [];
              if (categoryTemplates.length === 0 && !showAddForm && !editingId) return null;

              return (
                <div key={category} className="border-2 border-gray-200 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">{category}</h2>
                  {categoryTemplates.length === 0 ? (
                    <div className="text-gray-400 text-center py-4">템플릿이 없습니다.</div>
                  ) : (
                    <div className="space-y-3">
                      {categoryTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-700 mb-2">{template.key}</div>
                              <div className="text-sm text-gray-600 whitespace-pre-line">
                                {template.content}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => handleEdit(template)}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                title="수정"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => handleDelete(template.id)}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                title="삭제"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

