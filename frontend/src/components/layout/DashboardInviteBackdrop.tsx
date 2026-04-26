/**
 * Fundo estilo InviteBull: grain + auroras.
 * `light` — base clara com véus verdes suaves; `dark` — igual ao login.
 */
export function DashboardInviteBackdrop({ variant }: { variant: 'light' | 'dark' }) {
  const isDark = variant === 'dark';

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <svg className="hidden">
        <filter id="dashboard-invite-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
      <div
        className={`absolute inset-0 z-[1] ${isDark ? 'opacity-[0.028]' : 'opacity-[0.045]'}`}
        style={{ filter: 'url(#dashboard-invite-grain)', background: isDark ? 'white' : '#f8faf8' }}
      />
      {isDark ? (
        <>
          <div className="absolute inset-0 bg-[#161C24]" />
          <div
            className="animate-invite-aurora-1 absolute -top-[30%] -left-[20%] h-[70%] w-[70%] rounded-full blur-[120px]"
            style={{ background: 'oklch(0.38 0.18 152 / 0.28)' }}
          />
          <div
            className="animate-invite-aurora-2 absolute top-[20%] right-[-15%] h-[55%] w-[55%] rounded-full blur-[110px]"
            style={{ background: 'oklch(0.32 0.16 175 / 0.18)' }}
          />
          <div
            className="animate-invite-aurora-3 absolute bottom-[-20%] left-[30%] h-[50%] w-[45%] rounded-full blur-[100px]"
            style={{ background: 'oklch(0.28 0.14 140 / 0.15)' }}
          />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[oklch(0.97_0.014_150)]" />
          <div
            className="animate-invite-aurora-1 absolute -top-[28%] -left-[18%] h-[65%] w-[65%] rounded-full blur-[100px]"
            style={{ background: 'oklch(0.88 0.07 152 / 0.38)' }}
          />
          <div
            className="animate-invite-aurora-2 absolute top-[18%] right-[-12%] h-[52%] w-[52%] rounded-full blur-[95px]"
            style={{ background: 'oklch(0.90 0.05 165 / 0.28)' }}
          />
          <div
            className="animate-invite-aurora-3 absolute bottom-[-18%] left-[28%] h-[48%] w-[42%] rounded-full blur-[90px]"
            style={{ background: 'oklch(0.86 0.06 145 / 0.22)' }}
          />
        </>
      )}
    </div>
  );
}
