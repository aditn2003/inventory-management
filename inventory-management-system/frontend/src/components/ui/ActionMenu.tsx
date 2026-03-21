import { useState, useRef, useEffect, useCallback } from 'react';
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

const variantClasses: Record<string, string> = {
  default: 'text-gray-700 hover:bg-gray-100',
  danger: 'text-red-600 hover:bg-red-50',
  warning: 'text-amber-600 hover:bg-amber-50',
};

export function ActionMenu({ items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.right - 176, // 176px = w-44 (11rem)
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();

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
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
        aria-label="Actions"
      >
        <DotsThreeVertical size={20} weight="bold" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
            style={{ top: pos.top, left: Math.max(pos.left, 8) }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`w-full text-left px-4 py-2 text-sm first:rounded-t-lg last:rounded-b-lg ${
                  variantClasses[item.variant ?? 'default']
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
