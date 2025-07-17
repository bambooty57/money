import { useState } from 'react'
import { Input } from './ui/input'
import { useModelTypesRealtime } from '@/lib/useModelTypesRealtime';
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';

interface ModelTypeRow {
  id: string
  model: string
  type: string
  isEditing?: boolean
  editModel?: string
  editType?: string
}

interface ModelTypeManagerProps {
  onChange?: (id?: string) => void;
}

export default function ModelTypeManager(props: ModelTypeManagerProps) {
  const { onChange } = props || {};
  const modelTypes = useModelTypesRealtime();
  const [editRows, setEditRows] = useState<Record<string, { isEditing: boolean; editModel: string; editType: string }>>({});
  const [newModel, setNewModel] = useState('')
  const [newType, setNewType] = useState('')
  const [msg, setMsg] = useState('')
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(res => setSession(res.data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => { listener?.subscription.unsubscribe(); };
  }, []);

  function getRowState(row: ModelTypeRow) {
    return editRows[row.id] || { isEditing: false, editModel: row.model, editType: row.type };
  }

  function setRowState(row: ModelTypeRow, state: Partial<{ isEditing: boolean; editModel: string; editType: string }>) {
    setEditRows((prev) => ({ ...prev, [row.id]: { ...getRowState(row), ...state } }));
  }

  async function handleAdd() {
    if (!newModel || !newType) return setMsg('기종명/형식명을 모두 입력하세요')
    const res = await fetch('/api/models-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: newModel, type: newType })
    })
    if (res.ok) {
      const data = await res.json();
      setNewModel(''); setNewType(''); setMsg('추가 완료');
      if (onChange) onChange(data.id);
    } else {
      setMsg('추가 실패')
    }
  }

  async function handleDelete(id: string) {
    if (!session) return setMsg('로그인 후 이용 가능합니다');
    if (!confirm('정말 삭제하시겠습니까?')) return
    let accessToken = session?.access_token || '';
    const res = await fetch('/api/models-types', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify({ id })
    })
    if (res.ok) {
      let data: any = {};
      try { data = await res.json(); } catch {}
      setMsg('삭제 완료');
      if (onChange) onChange(id);
    } else {
      let err: any = {};
      try { err = await res.json(); } catch {}
      setMsg('삭제 실패: ' + (err?.error || res.status));
    }
  }

  function handleEditClick(row: ModelTypeRow) {
    setRowState(row, { isEditing: true, editModel: row.model, editType: row.type });
  }

  function handleEditCancel(row: ModelTypeRow) {
    setRowState(row, { isEditing: false, editModel: row.model, editType: row.type });
  }

  function handleInputChange(row: ModelTypeRow, field: 'editModel' | 'editType', value: string) {
    setRowState(row, { [field]: value });
  }

  async function handleEditSave(row: ModelTypeRow) {
    const state = getRowState(row);
    if (!row.id || !state.editModel || !state.editType) {
      setMsg('id, 기종명, 형식명을 모두 입력하세요')
      setRowState(row, { isEditing: false });
      return
    }
    if (!session) {
      setMsg('로그인 후 이용 가능합니다');
      setRowState(row, { isEditing: false });
      return;
    }
    let accessToken = session?.access_token || '';
    try {
      const res = await fetch('/api/models-types', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ id: row.id, model: state.editModel, type: state.editType })
      })
      if (res.ok) {
        let data: any = {};
        try { data = await res.json(); } catch {}
        setMsg('수정 완료')
        setRowState(row, { isEditing: false });
        if (onChange) onChange(row.id);
      } else {
        let err: any = {};
        try { err = await res.json(); } catch {}
        setMsg('수정 실패: ' + (err?.error || res.status))
        setRowState(row, { isEditing: false });
      }
    } catch (e) {
      setMsg('수정 실패: ' + (e instanceof Error ? e.message : String(e)))
      setRowState(row, { isEditing: false });
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">기종/형식명 관리</h2>
      {msg && <div className="text-sm text-blue-600">{msg}</div>}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-1">기종명</th>
              <th className="border p-1">형식명</th>
              <th className="border p-1">수정</th>
              <th className="border p-1">삭제</th>
            </tr>
          </thead>
          <tbody>
            {[...modelTypes].sort((a, b) => {
              const modelCmp = (a.model || '').localeCompare(b.model || '', 'ko');
              if (modelCmp !== 0) return modelCmp;
              return (a.type || '').localeCompare(b.type || '', 'ko');
            }).map((row, i) => {
              const state = getRowState(row);
              return (
                <tr key={row.id || `${row.model}-${row.type}-${i}`}>
                  <td className="border p-1">
                    {state.isEditing ? (
                      <Input value={state.editModel ?? ''} onChange={e => handleInputChange(row, 'editModel', e.target.value)} />
                    ) : row.model}
                  </td>
                  <td className="border p-1">
                    {state.isEditing ? (
                      <Input value={state.editType ?? ''} onChange={e => handleInputChange(row, 'editType', e.target.value)} />
                    ) : row.type}
                  </td>
                  <td className="border p-1">
                    {state.isEditing ? (
                      <>
                        <button onClick={() => handleEditSave(row)} className="text-blue-600">저장</button>
                        <button onClick={() => handleEditCancel(row)} className="ml-2 text-gray-500">취소</button>
                      </>
                    ) : (
                      <button onClick={() => handleEditClick(row)} className="text-blue-600">수정</button>
                    )}
                  </td>
                  <td className="border p-1">
                    <button onClick={() => handleDelete(row.id)} className="text-red-600">삭제</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 mt-2">
        <Input value={newModel} onChange={e => setNewModel(e.target.value)} placeholder="기종명" />
        <Input value={newType} onChange={e => setNewType(e.target.value)} placeholder="형식명" />
        <button onClick={handleAdd} className="bg-blue-600 text-white px-3 py-1 rounded">추가</button>
      </div>
    </div>
  )
} 