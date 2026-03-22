import { Sun, Moon } from '@phosphor-icons/react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-7 rounded-full bg-slate-200 dark:bg-neutral-700
        transition-colors duration-300 focus:outline-none focus:ring-2
        focus:ring-primary-500/30 focus:ring-offset-2 dark:focus:ring-offset-neutral-900"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white dark:bg-neutral-900
          shadow-sm flex items-center justify-center transition-transform duration-300
          ${theme === 'dark' ? 'translate-x-7' : 'translate-x-0'}`}
      >
        {theme === 'dark' ? (
          <Moon size={14} weight="fill" className="text-primary-400" />
        ) : (
          <Sun size={14} weight="fill" className="text-primary-500" />
        )}
      </span>
    </button>
  );
}
