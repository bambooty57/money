import { useState } from 'react'

type Option = { model: string; type: string }

type Props = {
  onSelect: (opt: Option) => void
}

export function ProductModelTypeAutocomplete({ onSelect }: Props) {
  const [input, setInput] = useState('')
  const [options, setOptions] = useState<Option[]>([])

  async function fetchOptions(q: string) {
    if (!q) return setOptions([])
    const res = await fetch(`/api/models-types?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setOptions(data)
  }

  return (
    <div>
      <input
        value={input}
        onChange={e => {
          setInput(e.target.value)
          fetchOptions(e.target.value)
        }}
        placeholder='기종/형식명 입력'
        className='border px-2 py-1 rounded w-full'
      />
      {options.length > 0 && (
        <ul className='border rounded bg-white mt-1 max-h-40 overflow-auto'>
          {options.map(opt => (
            <li
              key={opt.model + opt.type}
              onClick={() => {
                onSelect(opt)
                setInput(opt.model + (opt.type ? ' / ' + opt.type : ''))
                setOptions([])
              }}
              className='px-2 py-1 hover:bg-blue-100 cursor-pointer'
            >
              {opt.model} / {opt.type}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
} 