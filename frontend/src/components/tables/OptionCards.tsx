interface Option<T> {
  value: T;
  title: string;
  description: string;
  disabled?: boolean;
}

interface Props<T> {
  label: string;
  options: Array<Option<T>>;
  value: T;
  onChange: (value: T) => void;
}

/** Grupo de cartoes de escolha (modalidade, formato, valor da mesa). */
export default function OptionCards<T extends string | number>({ label, options, value, onChange }: Props<T>) {
  return (
    <>
      <span className="label">{label}</span>
      <div className="option-cards">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'option-card active' : 'option-card'}
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            disabled={option.disabled}
          >
            <strong>{option.title}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
    </>
  );
}
