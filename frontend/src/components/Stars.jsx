export default function Stars({ value, onChange, size = 22, label }) {
  return (
    <div className="flex items-center gap-0.5" role={onChange ? 'radiogroup' : 'img'} aria-label={label || `${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = (
          <span className={`material-symbols-outlined ${n <= value ? 'text-amber-500' : 'text-outline-variant'}`}
            style={{ fontSize: size, fontVariationSettings: `'FILL' ${n <= value ? 1 : 0}` }}>star</span>
        );
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n}/5`}
            className="p-0.5 rounded-lg hover:bg-surface-container transition-colors" onClick={() => onChange(n)}>{icon}</button>
        ) : <span key={n}>{icon}</span>;
      })}
    </div>
  );
}
