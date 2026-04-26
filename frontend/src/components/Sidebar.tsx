import { LayoutDashboard, History, Settings, LogOut, HelpCircle } from 'lucide-react';
import { CopyFyMark } from './brand/CopyFyLogo';

interface SidebarProps {
  activePage: string;
  onPageChange: (page: string) => void;
  robotRunning: boolean;
  onLogout: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Início',        icon: LayoutDashboard },
  { id: 'history',   label: 'Histórico',     icon: History },
  { id: 'settings',  label: 'Configurações', icon: Settings },
];

const tooltipClass =
  'pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold tracking-wide opacity-0 shadow-xl backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100 max-md:ml-2';

export default function Sidebar({ activePage, onPageChange, robotRunning, onLogout }: SidebarProps) {
  return (
    <nav
      className="relative z-10 hidden h-full w-[72px] flex-shrink-0 flex-col items-stretch border-r border-[oklch(0.90_0.02_145)]/90 bg-gradient-to-b from-white via-[oklch(0.992_0.006_150)] to-[oklch(0.97_0.012_150)] py-5 shadow-[inset_-1px_0_0_rgba(22,101,52,0.06)] dark:border-white/[0.08] dark:from-[#141A22] dark:via-[#161C24] dark:to-[#161C24] dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.05),-4px_0_24px_-12px_rgba(0,0,0,0.35)] md:flex"
      aria-label="Navegação principal"
    >
      <div className="mb-6 flex justify-center px-2.5" title="Robô Auto">
        <CopyFyMark className="h-9 w-auto" />
      </div>

      {robotRunning && (
        <div className="mx-auto mb-5 flex items-center justify-center" title="Robô ativo">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.62_0.20_152)] opacity-40" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[oklch(0.62_0.20_152)] shadow-[0_0_12px_oklch(0.62_0.20_152/0.8)]" />
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1 px-2.5">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPageChange(id)}
              title={label}
              className={`group relative flex h-11 w-full items-center justify-center rounded-xl transition-all duration-200 ${
                active
                  ? 'bg-[oklch(0.62_0.20_152/0.14)] text-[oklch(0.22_0.06_155)] shadow-[0_0_0_1px_oklch(0.62_0.20_152/0.28),0_8px_24px_-10px_oklch(0.62_0.20_152/0.35)] dark:bg-[oklch(0.62_0.20_152/0.16)] dark:text-[#F1F5F9] dark:shadow-[0_0_0_1px_oklch(0.62_0.20_152/0.28),0_12px_28px_-12px_oklch(0.62_0.20_152/0.25)]'
                  : 'text-[oklch(0.48_0.02_150)] hover:bg-black/[0.045] hover:text-[oklch(0.22_0.02_155)] dark:text-[#9CA8B8] dark:hover:bg-white/[0.08] dark:hover:text-[#F1F5F9]'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
              <span
                className={`${tooltipClass} border-[oklch(0.88_0.02_145)]/90 bg-white/95 text-[oklch(0.22_0.02_155)] dark:border-white/[0.1] dark:bg-[#212B36] dark:text-[#F1F5F9]`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="mx-3 my-3 h-px bg-gradient-to-r from-transparent via-[oklch(0.88_0.02_145)] to-transparent opacity-80 dark:via-white/[0.12]"
        aria-hidden
      />

      <div className="flex flex-col gap-1 px-2.5">
        <button
          type="button"
          title="Ajuda"
          className="group relative flex h-11 w-full items-center justify-center rounded-xl text-[oklch(0.48_0.02_150)] transition-all duration-200 hover:bg-black/[0.045] hover:text-[oklch(0.22_0.02_155)] dark:text-[#9CA8B8] dark:hover:bg-white/[0.08] dark:hover:text-[#F1F5F9]"
        >
          <HelpCircle className="h-[18px] w-[18px]" strokeWidth={2} />
          <span
            className={`${tooltipClass} border-[oklch(0.88_0.02_145)]/90 bg-white/95 text-[oklch(0.22_0.02_155)] dark:border-white/[0.1] dark:bg-[#212B36] dark:text-[#F1F5F9]`}
          >
            Ajuda
          </span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          title="Sair"
          className="group relative flex h-11 w-full items-center justify-center rounded-xl text-[oklch(0.48_0.02_150)] transition-all duration-200 hover:bg-red-500/[0.08] hover:text-red-600 dark:text-[#9CA8B8] dark:hover:bg-red-500/15 dark:hover:text-red-400"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
          <span
            className={`${tooltipClass} border-red-200/80 bg-white/95 text-red-700 dark:border-red-500/25 dark:bg-[oklch(0.12_0.04_25)] dark:text-red-300`}
          >
            Sair
          </span>
        </button>
      </div>
    </nav>
  );
}
