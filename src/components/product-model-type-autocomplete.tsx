import { useState, useEffect } from 'react'
import { Input } from './ui/input'
import { Dialog, DialogContent } from './ui/dialog';
import ModelTypeManager from './model-type-manager';
import { useModelTypesRealtime } from '@/lib/useModelTypesRealtime';
import { DialogHeader, DialogTitle } from './ui/dialog';

type Option = { id: string; model: string; type: string }

type Props = {
  selectedId: string;
  onSelect: (id: string) => void;
  refresh?: number;
}

export function ProductModelTypeDropdown({ selectedId, onSelect, refresh }: Props) {
  const [options, setOptions] = useState<Option[]>([])
  const [open, setOpen] = useState(false)

  // Fetch options utility for reuse
  const fetchOptions = async () => {
    const res = await fetch(`/api/models-types`)
    const data: Option[] = await res.json()
    setOptions(data)
    return data;
  }

  useEffect(() => {
    fetchOptions()
  }, [refresh])

  useModelTypesRealtime({ onChange: fetchOptions });

  // Refresh options after modal closes
  const handleDialogOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      fetchOptions()
    }
  }

  // Immediate refresh on ModelTypeManager change
  const handleManagerChange = async (newId?: string) => {
    const data = await fetchOptions();
    if (newId) {
      setOpen(false); // 직접입력(추가) 시 모달 자동 닫힘
      onSelect(newId);
    } else if (data.length > 0) {
      onSelect(data[data.length - 1].id);
    }
  };

  return (
    <div className="space-y-2">
      <label>기종/형식명</label>
      <select
        value={selectedId}
        onChange={e => {
          if (e.target.value === '__custom__') {
            setOpen(true)
            return
          }
          onSelect(e.target.value)
        }}
        className="w-full border rounded p-2 mb-2"
        title="기종/형식명 선택"
      >
        <option value="">기종/형식명을 선택하세요</option>
        {options.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.model} / {opt.type}</option>
        ))}
        <option value="__custom__">직접입력 (기종/형식명 관리)</option>
      </select>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>기종/형식명 관리</DialogTitle>
          </DialogHeader>
          <ModelTypeManager onChange={handleManagerChange} />
        </DialogContent>
      </Dialog>
    </div>
  )
} 