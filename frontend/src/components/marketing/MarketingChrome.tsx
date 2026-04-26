import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { CopyFyLogo } from '../brand/CopyFyLogo';

export const marketingBg = 'bg-[#161C24]';
export const marketingSurface = 'bg-[#212B36]/85';
export const marketingSurfaceSolid = 'bg-[#212B36]';
export const marketingText = 'text-[#F1F5F9]';
export const marketingMuted = 'text-[#B4C0CE]';
export const marketingBorderSubtle = 'border-white/[0.1]';

const navPillClass =
  'inline-flex items-center rounded-full bg-white/[0.06] px-4 py-2 text-sm font-medium text-[#B4C0CE] transition-colors hover:bg-white/[0.1] hover:text-[#F1F5F9]';

export type MarketingNavItem = { href: string; label: string };

/** Menu principal: igual na home e no guia do copy (âncoras da home com /#…). */
export const MARKETING_MAIN_NAV: MarketingNavItem[] = [
  { href: '/#sobre', label: 'Sobre nós' },
  { href: '/copy-trading', label: 'Guia do copy' },
  { href: '/#contato', label: 'Contato' },
];

function NavItem({ href, label }: MarketingNavItem) {
  const location = useLocation();

  if (href.startsWith('#') && !href.startsWith('/')) {
    return (
      <a href={href} className={navPillClass}>
        {label}
      </a>
    );
  }

  const homeSection = href.match(/^\/#([\w-]+)$/);
  if (homeSection) {
    const id = homeSection[1];
    return (
      <Link
        to={{ pathname: '/', hash: id }}
        className={navPillClass}
        onClick={() => {
          if (location.pathname === '/') {
            requestAnimationFrame(() => {
              document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }
        }}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link to={href} className={navPillClass}>
      {label}
    </Link>
  );
}

export function MarketingHeader({ navItems }: { navItems: MarketingNavItem[] }) {
  return (
    <header
      className={`sticky top-0 z-50 border-b ${marketingBorderSubtle} ${marketingBg}/90 backdrop-blur-xl`}
    >
      <div className="mx-auto max-w-7xl px-5 py-4 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex shrink-0 items-center gap-3 group" aria-label="Robô Auto — início">
            <span className="transition-transform group-hover:scale-[1.02]">
              <CopyFyLogo
                iconClassName="h-9 w-auto"
                wordmarkClassName="font-display text-lg font-bold tracking-tight text-[#F1F5F9]"
              />
            </span>
          </Link>

          <nav
            className="hidden md:flex flex-1 flex-wrap items-center justify-center gap-2 lg:gap-1"
            aria-label="Principal"
          >
            {navItems.map((item) => (
              <NavItem key={item.href + item.label} {...item} />
            ))}
          </nav>

          <Link
            to="/login"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/[0.08] pl-2 pr-4 py-2 text-sm font-semibold text-[#F1F5F9] ring-1 ring-white/10 transition hover:bg-white/[0.12]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[oklch(0.62_0.20_152)] text-white">
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
            </span>
            Entrar
          </Link>
        </div>

        <nav
          className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Principal móvel"
        >
          {navItems.map((item) => (
            <NavItem key={`m-${item.href + item.label}`} {...item} />
          ))}
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer
      className={`border-t ${marketingBorderSubtle} px-5 py-6 text-center text-xs text-[#B4C0CE] lg:px-8`}
    >
      Robô Auto · Operações Bullex
    </footer>
  );
}
