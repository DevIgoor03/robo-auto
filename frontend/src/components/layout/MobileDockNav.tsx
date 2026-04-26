import type { LucideIcon } from 'lucide-react';
import { LogOut } from 'lucide-react';

export type DockNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type Props = {
  items: DockNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Ponto “ao vivo” no primeiro item (ex.: cópia a correr). */
  showLiveOnFirst?: boolean;
  onLogout?: () => void;
};

/**
 * Navegação fixa no fundo em viewports &lt; md (complementa a sidebar oculta no mobile).
 */
export function MobileDockNav({ items, activeId, onSelect, showLiveOnFirst, onLogout }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(3.75rem+env(safe-area-inset-bottom,0px))] items-stretch border-t border-[oklch(0.88_0.02_145)]/95 bg-gradient-to-t from-[oklch(0.99_0.008_150)] to-white pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.08)] dark:border-white/[0.1] dark:from-[#161C24] dark:to-[#212B36] dark:shadow-[0_-8px_32px_-12px_rgba(0,0,0,0.45)] md:hidden"
      aria-label="Navegação"
    >
      <div className="flex min-h-0 flex-1 items-center justify-around gap-0.5 px-1 pt-1">
        {items.map(({ id, label, icon: Icon }, index) => {
          const active = activeId === id;
          const showPulse = showLiveOnFirst && index === 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-colors ${
                active
                  ? 'text-[oklch(0.22_0.06_155)] dark:text-[#F1F5F9]'
                  : 'text-[oklch(0.48_0.02_150)] dark:text-[#9CA8B8]'
              }`}
            >
              {showPulse && (
                <span className="absolute right-[22%] top-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.62_0.20_152)] opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[oklch(0.62_0.20_152)]" />
                </span>
              )}
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  active
                    ? 'bg-[oklch(0.62_0.20_152/0.18)] shadow-[0_0_0_1px_oklch(0.62_0.20_152/0.3)] dark:bg-[oklch(0.62_0.20_152/0.2)]'
                    : 'bg-transparent'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
              </span>
              <span className="max-w-full truncate px-0.5 text-center text-[10px] font-semibold leading-tight">{label}</span>
            </button>
          );
        })}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-red-600 transition-colors dark:text-red-400"
            title="Sair"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-transparent">
              <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <span className="text-center text-[10px] font-semibold leading-tight">Sair</span>
          </button>
        )}
      </div>
    </nav>
  );
}
