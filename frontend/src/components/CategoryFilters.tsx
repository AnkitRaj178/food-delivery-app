type CategoryFiltersProps = {
  categories: string[]
  selected: string | null
  onSelect: (value: string | null) => void
}

export default function CategoryFilters({ categories, selected, onSelect }: CategoryFiltersProps) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
          selected == null
            ? 'bg-orange-600 text-white'
            : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300'
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onSelect(category)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            selected === category
              ? 'bg-orange-600 text-white'
              : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  )
}
