import { useEffect, useState } from "react"
import { listCities } from "../api/cities"
import type { CityOption } from "../types/city"

interface CityAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onOptionSelect?: (option: CityOption | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const baseInputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-orange-400/70"

const CityAutocomplete = ({
  value,
  onChange,
  onOptionSelect,
  placeholder = "Оберіть місто",
  disabled = false,
  className,
}: CityAutocompleteProps) => {
  const [inputValue, setInputValue] = useState(value)
  const [options, setOptions] = useState<CityOption[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    if (!isOpen || disabled) {
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setIsLoading(true)
        const cities = await listCities(inputValue, 12, controller.signal)
        if (!controller.signal.aborted) {
          setOptions(cities)
        }
      } catch {
        if (!controller.signal.aborted) {
          setOptions([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }, 200)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [disabled, inputValue, isOpen])

  const handleInputChange = (nextValue: string) => {
    setInputValue(nextValue)
    setIsOpen(true)
    onChange(nextValue)
    onOptionSelect?.(null)
  }

  const handleSelect = (option: CityOption) => {
    setInputValue(option.name_uk)
    onChange(option.name_uk)
    onOptionSelect?.(option)
    setIsOpen(false)
  }

  const handleBlur = () => {
    window.setTimeout(() => {
      setInputValue(value)
      setIsOpen(false)
    }, 120)
  }

  return (
    <div className="relative">
      <input
        className={className ?? baseInputClassName}
        placeholder={placeholder}
        value={inputValue}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={handleBlur}
        disabled={disabled}
      />

      {isOpen && !disabled && (
        <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-slate-500">Пошук міст...</div>
          ) : options.length > 0 ? (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition last:border-b-0 hover:bg-orange-50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(option)}
              >
                <span className="font-medium text-slate-900">{option.name_uk}</span>
                <span className="ml-1 text-slate-500">({option.name_en}, {option.oblast})</span>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500">Місто не знайдено</div>
          )}
        </div>
      )}
    </div>
  )
}

export default CityAutocomplete
