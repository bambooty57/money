import { useState, useEffect } from 'react'
import { Input } from './ui/input'

type Option = { id: string; model: string; type: string }

type Props = {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ProductModelTypeDropdown({ selectedId, onSelect }: Props) {
  const [options, setOptions] = useState<Option[]>([])
  const [selected, setSelected] = useState<string>(selectedId)

  useEffect(() => {
    async function fetchOptions() {
      const res = await fetch(`/api/models-types`)
      const data: Option[] = await res.json()
      setOptions(data)
    }
    fetchOptions()
  }, [])

  useEffect(() => {
    setSelected(selectedId)
  }, [selectedId])

  return (
    <div className="space-y-2">
      <label>기종/형식명</label>
      <select
        value={selected}
        onChange={e => {
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
      </select>
    </div>
  )
} 