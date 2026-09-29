import { ChevronDown, Check } from 'lucide-react';
import { Popover } from './Popover';

interface SelectProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}

export function Select<T extends string>({ value, options, onChange, label }: SelectProps<T>) {
  const current = options.find((o) => o.value === value);
  return (
    <Popover
      label={label}
      trigger={
        <button type="button" className="select-btn" aria-label={label}>
          <span className="select-value">{current?.label ?? value}</span>
          <ChevronDown />
        </button>
      }
    >
      {(close) => (
        <div role="listbox" aria-label={label}>
          {options.map((o) => (
            <button
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className="popover-item"
              onClick={() => {
                onChange(o.value);
                close();
              }}
            >
              {o.value === value ? <Check className="check" /> : <span className="placeholder" />}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
