import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DotsThreeVertical } from '@phosphor-icons/react';

interface ActionItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'warning';
}

interface ActionMenuProps {
  items: ActionItem[];
}

const MENU_WIDTH = 176; // Tailwind w-44
const GAP = 6;
const VIEWPORT_PADDING = 8;

const variantClasses: Record<string, string> = {
  default: 'text-slate-700 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-neutral-700',
  danger: 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10',
  warning: 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10',
};

function estimateMenuHeight(itemCount: number) {
  return 8 + itemCount * 40;
}

function computeMenuPosition(
  rect: DOMRect,
  menuHeight: number,
  viewportW: number,
  viewportH: number
) {
  const spaceBelow = viewportH - VIEWPORT_PADDING - (rect.bottom + GAP);
  const spaceAbove = rect.top - GAP - VIEWPORT_PADDING;

  let top: number;

  if (menuHeight <= spaceBelow) {
    top = rect.bottom + GAP;
  } else if (menuHeight <= spaceAbove) {
    top = rect.top - menuHeight - GAP;
  } else {
    if (spaceBelow >= spaceAbove) {
      top = rect.bottom + GAP;
    } else {
      top = rect.top - menuHeight - GAP;
    }
    top = Math.max(
      VIEWPORT_PADDING,
      Math.min(top, viewportH - menuHeight - VIEWPORT_PADDING)
    );
  }

  const left = Math.max(
    VIEWPORT_PADDING,
    Math.min(rect.right - MENU_WIDTH, viewportW - MENU_WIDTH - VIEWPORT_PADDING)
  );

  return { top, left };
}

export function ActionMenu({ items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const measured = menuRef.current?.getBoundingClientRect().height ?? 0;
    const menuHeight = measured > 0 ? measured : estimateMenuHeight(items.length);
    setPos(computeMenuPosition(rect, menuHeight, window.innerWidth, window.innerHeight));
  }, [items.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const id = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(id);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleScroll() {
      setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleResize() {
      updatePosition();
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open, updatePosition]);

  const dangerIdx = items.findIndex((i) => i.variant === 'danger');

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300
          transition-colors duration-150"
        aria-label="Actions"
      >
        <DotsThreeVertical size={20} weight="bold" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed w-44 bg-white dark:bg-neutral-800 border border-slate-200/80 dark:border-neutral-700/80 rounded-xl
              shadow-elevated z-[1000] animate-scale-in overflow-hidden"
            style={{ top: pos.top, left: pos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-1">
              {items.map((item, idx) => (
                <span key={item.label}>
                  {idx === dangerIdx && dangerIdx > 0 && (
                    <div className="border-t border-slate-100 dark:border-neutral-700 my-1" />
                  )}
                  <button
                    onClick={() => {
                      setOpen(false);
                      item.onClick();
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors duration-150 ${
                      variantClasses[item.variant ?? 'default']
                    }`}
                  >
                    {item.label}
                  </button>
                </span>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
