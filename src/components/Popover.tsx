import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'left' | 'right';
  label?: string;
}

/**
 * Popover：portal + fixed 定位。
 * 不受任何 overflow:hidden / 层叠上下文影响，始终浮在最上层。
 */
export function Popover({ trigger, children, align = 'right', label }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos(
      align === 'left'
        ? { top: r.bottom + 6, left: r.left }
        : { top: r.bottom + 6, right: window.innerWidth - r.right },
    );
  }, [open, align]);

  // 打开后测量：视口底部放不下时向上翻转；左右越界时 clamp 回视口内
  useEffect(() => {
    if (!open || !pos || !popRef.current || !anchorRef.current) return;
    const pr = popRef.current.getBoundingClientRect();
    const ar = anchorRef.current.getBoundingClientRect();
    let next: { top: number; left?: number; right?: number } | null = null;

    // 垂直翻转
    if (pr.bottom > window.innerHeight - 8) {
      const flippedTop = Math.max(8, ar.top - pr.height - 6);
      if (flippedTop !== pos.top) next = { ...pos, top: flippedTop };
    }
    // 水平 clamp：弹出层左缘越出视口 → 固定 left=8；右缘越出 → 固定 right=8
    const curLeft = pr.left;
    const curRight = window.innerWidth - pr.right;
    if (curLeft < 8) {
      next = { ...(next ?? pos), left: 8, right: undefined };
    } else if (curRight < 8) {
      next = { ...(next ?? pos), left: undefined, right: 8 };
    }
    if (next) setPos(next);
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = (e: Event) => {
      const t = e.target as Node;
      // 忽略 iframe 内部与无关文档的滚动（如 HTML 预览沙箱）
      if (t !== document && t !== document.body && !document.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <div className="popover-anchor" ref={anchorRef}>
      <span onClick={() => setOpen((o) => !o)} style={{ display: 'inline-flex' }}>
        {trigger}
      </span>
      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            className={`popover ${align === 'left' ? 'left' : ''}`}
            style={{
              position: 'fixed',
              top: pos.top,
              ...(pos.left !== undefined ? { left: pos.left } : {}),
              ...(pos.right !== undefined ? { right: pos.right } : {}),
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={label}
          >
            {typeof children === 'function' ? children(() => setOpen(false)) : children}
          </div>,
          document.body,
        )}
    </div>
  );
}
