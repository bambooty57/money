import { useEffect, useState } from 'react'
import { Input } from './ui/input'

interface ModelTypeRow {
  id: string
  model: string
  type: string
  isEditing?: boolean
  editModel?: string
  editType?: string
}

interface ModelTypeManagerProps {
  onChange?: () => void;
}

export default function ModelTypeManager({ onChange }: ModelTypeManagerProps = {}) {
  const [rows, setRows] = useState<ModelTypeRow[]>([])
  const [newModel, setNewModel] = useState('')
  const [newType, setNewType] = useState('')
  const [msg, setMsg] = useState('')

  async function fetchRows() {
    const res = await fetch('/api/models-types')
    const data = await res.json()
    setRows(data.map((row: ModelTypeRow) => ({ ...row, isEditing: false, editModel: row.model, editType: row.type })))
  }

  useEffect(() => { fetchRows() }, [])

  async function handleAdd() {
    if (!newModel || !newType) return setMsg('기종명/형식명을 모두 입력하세요')
    const res = await fetch('/api/models-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: newModel, type: newType })
    })
    if (res.ok) {
      setNewModel(''); setNewType(''); setMsg('추가 완료'); fetchRows();
      if (onChange) onChange();
    } else {
      setMsg('추가 실패')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const res = await fetch('/api/models-types', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (res.ok) { setMsg('삭제 완료'); fetchRows(); if (onChange) onChange(); } else { setMsg('삭제 실패') }
  }

  function handleEditClick(idx: number) {
    setRows(rows => rows.map((row, i) => i === idx ? { ...row, isEditing: true, editModel: row.model, editType: row.type } : { ...row, isEditing: false }))
  }

  function handleEditCancel(idx: number) {
    setRows(rows => rows.map((row, i) => i === idx ? { ...row, isEditing: false, editModel: row.model, editType: row.type } : row))
  }

  function handleInputChange(idx: number, field: 'editModel' | 'editType', value: string) {
    setRows(rows => rows.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  async function handleEditSave(idx: number) {
    const row = rows[idx]
    if (!row.id || !row.editModel || !row.editType) {
      setMsg('id, 기종명, 형식명을 모두 입력하세요')
      setRows(rows => rows.map((r, i) => i === idx ? { ...r, isEditing: false } : r))
      return
    }
    const res = await fetch('/api/models-types', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, model: row.editModel, type: row.editType })
    })
    if (res.ok) {
      setMsg('수정 완료')
      setRows(rows => rows.map((r, i) => i === idx ? { ...r, isEditing: false } : r))
      fetchRows();
      if (onChange) onChange();
    } else {
      const err = await res.json().catch(() => ({}))
      setMsg('수정 실패: ' + (err?.error || res.status))
      setRows(rows => rows.map((r, i) => i === idx ? { ...r, isEditing: false } : r))
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
            {rows.map((row, i) => (
              <tr key={row.id || `${row.model}-${row.type}-${i}`}>
                <td className="border p-1">
                  {row.isEditing ? (
                    <Input value={row.editModel ?? ''} onChange={e => handleInputChange(i, 'editModel', e.target.value)} />
                  ) : row.model}
                </td>
                <td className="border p-1">
                  {row.isEditing ? (
                    <Input value={row.editType ?? ''} onChange={e => handleInputChange(i, 'editType', e.target.value)} />
                  ) : row.type}
                </td>
                <td className="border p-1">
                  {row.isEditing ? (
                    <>
                      <button onClick={() => handleEditSave(i)} className="text-blue-600">저장</button>
                      <button onClick={() => handleEditCancel(i)} className="ml-2 text-gray-500">취소</button>
                    </>
                  ) : (
                    <button onClick={() => handleEditClick(i)} className="text-blue-600">수정</button>
                  )}
                </td>
                <td className="border p-1">
                  <button onClick={() => handleDelete(row.id)} className="text-red-600">삭제</button>
                </td>
              </tr>
            ))}
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