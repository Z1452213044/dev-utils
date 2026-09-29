import { useLayoutEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel }: SegmentedControlProps<T>) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const index = options.findIndex((o) => o.value === value);
    const el = itemRefs.current[index];
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [options, value]);

  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {thumb && (
        <span
          className="segmented-thumb"
          style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
        />
      )}
      {options.map((o, i) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            role="radio"
            aria-checked={o.value === value}
            className="segmented-option"
            onClick={() => onChange(o.value)}
          >
            {Icon && <Icon />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
