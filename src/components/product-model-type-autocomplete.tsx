import { useState, useEffect } from 'react'
import { Input } from './ui/input'
import { Dialog, DialogContent } from './ui/dialog';
import ModelTypeManager from './model-type-manager';

type Option = { id: string; model: string; type: string }

type Props = {
  selectedId: string;
  onSelect: (id: string) => void;
  refresh?: number;
}

export function ProductModelTypeDropdown({ selectedId, onSelect, refresh }: Props) {
  const [options, setOptions] = useState<Option[]>([])
  const [selected, setSelected] = useState<string>(selectedId)
  const [open, setOpen] = useState(false)

  // Fetch options utility for reuse
  const fetchOptions = async () => {
    const res = await fetch(`/api/models-types`)
    const data: Option[] = await res.json()
    setOptions(data)
  }

  useEffect(() => {
    fetchOptions()
  }, [refresh])

  useEffect(() => {
    setSelected(selectedId)
  }, [selectedId])

  // Refresh options after modal closes
  const handleDialogOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      fetchOptions()
    }
  }

  // Immediate refresh on ModelTypeManager change
  const handleManagerChange = async () => {
    await fetchOptions();
    // fetchOptions 후 options 최신화 보장 위해 setTimeout 0으로 비동기 처리
    setTimeout(() => {
      if (options.length > 0) {
        // 가장 마지막 항목(최신 추가)을 자동 선택
        const last = options[options.length - 1];
        setSelected(last.id);
        onSelect(last.id);
      }
    }, 0);
  };

  return (
    <div className="space-y-2">
      <label>기종/형식명</label>
      <select
        value={selected}
        onChange={e => {
          if (e.target.value === '__custom__') {
            setOpen(true)
            return
          }
          setSelected(e.target.value)
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
          <ModelTypeManager onChange={handleManagerChange} />
        </DialogContent>
      </Dialog>
    </div>
  )
} 