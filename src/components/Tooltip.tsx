import { useRef, useState, useCallback } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label: string;
  children: ReactNode;
  placement?: 'bottom' | 'top';
}

/** 轻量 Tooltip：延迟 ~400ms 出现，克制的深色气泡。 */
export function Tooltip({ label, children, placement = 'bottom' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (!label) return;
    timer.current = setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) {
        setPos({ x: rect.left + rect.width / 2, y: placement === 'bottom' ? rect.bottom : rect.top });
        setVisible(true);
      }
    }, 400);
  }, [placement, label]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  }, []);

  const style: CSSProperties =
    pos == null
      ? { display: 'none' }
      : placement === 'bottom'
        ? { left: pos.x, top: pos.y + 7 }
        : { left: pos.x, top: pos.y - 7 };

  return (
    <span
      ref={anchorRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={show}
      onBlur={hide}
      style={{ display: 'inline-flex' }}
    >
      {children}
      {visible &&
        createPortal(
          <div className={`tooltip ${placement}`} role="tooltip" style={style}>
            {label}
          </div>,
          document.body,
        )}
    </span>
  );
}
