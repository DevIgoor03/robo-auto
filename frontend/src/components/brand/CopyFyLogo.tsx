/** Mesmo verde do losango superior do ícone (mantém wordmark alinhado ao mark). */
export const COPYFY_MARK_GREEN = '#00C853';

/**
 * Marca Robô Auto: três losangos + wordmark opcional.
 */
export function CopyFyMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 56 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <polygon points="28,4.5 36.2,13.8 28,23.1 19.8,13.8" fill={COPYFY_MARK_GREEN} />
      <polygon points="16,21.5 24.8,31.2 16,40.9 7.2,31.2" fill="#3d3d3d" />
      <polygon points="40,21.5 48.8,31.2 40,40.9 31.2,31.2" fill="#3d3d3d" />
    </svg>
  );
}

type CopyFyLogoProps = {
  className?: string;
  /** Classes Tailwind no ícone (ex.: h-7 w-7) */
  iconClassName?: string;
  /** Classes no wordmark: aplicadas ao contentor; “Copy” herda Syne; “Fy” usa Space Grotesk itálico (Syne não tem itálico carregado) + verde do ícone */
  wordmarkClassName?: string;
  /** Se false, só o símbolo */
  showWordmark?: boolean;
};

export function CopyFyLogo({
  className = '',
  iconClassName = 'h-7 w-auto shrink-0',
  wordmarkClassName = 'font-display text-base font-bold tracking-tight',
  showWordmark = true,
}: CopyFyLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <CopyFyMark className={iconClassName} />
      {showWordmark && (
        <span className={wordmarkClassName}>
          <span>Robô </span>
          <span className="italic font-bold" style={{ color: COPYFY_MARK_GREEN }}>
            Auto
          </span>
        </span>
      )}
    </span>
  );
}
