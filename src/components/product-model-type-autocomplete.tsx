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
  // options state 제거, 실시간 modelTypes 사용
  const modelTypes = useModelTypesRealtime();
  const [open, setOpen] = useState(false)

  // fetchOptions는 직접입력(모달) 후 강제 갱신용으로만 사용
  const fetchOptions = async () => {
    // 실시간 동기화가 보장되지만, 직접입력(추가/수정/삭제) 후 강제 fetch로 최신화
    await fetch(`/api/models-types`)
    // modelTypes는 useModelTypesRealtime()에서 자동 갱신됨
  }

  // 모달 닫힘 시 fetchOptions 제거 (실시간만 신뢰)
  const handleDialogOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
  }

  // 직접입력(추가/수정/삭제) 후 강제 fetch
  const handleManagerChange = async (newId?: string) => {
    await fetchOptions();
    if (newId) {
      setOpen(false);
      onSelect(newId);
    } else if (modelTypes.length > 0) {
      onSelect(modelTypes[modelTypes.length - 1].id);
    }
  };

  return (
    <div className="space-y-2">
      <label>기종/형식명</label>
      <select
        value={String(selectedId)}
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
        {/* selectedId가 modelTypes에 없으면 fallback 표시 */}
        {selectedId && !modelTypes.find(opt => String(opt.id) === String(selectedId)) && (
          <option value={String(selectedId)} style={{ color: 'red' }}>이전 선택값(삭제됨)</option>
        )}
        {[...modelTypes].sort((a, b) => {
          const modelCmp = (a.model || '').localeCompare(b.model || '', 'ko');
          if (modelCmp !== 0) return modelCmp;
          return (a.type || '').localeCompare(b.type || '', 'ko');
        }).map(opt => (
          <option key={String(opt.id)} value={String(opt.id)}>{opt.model} / {opt.type}</option>
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