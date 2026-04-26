import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  LayoutDashboard,
  Users,
  Zap,
} from 'lucide-react';
import {
  MARKETING_MAIN_NAV,
  MarketingFooter,
  MarketingHeader,
  marketingBg,
  marketingBorderSubtle,
  marketingMuted,
  marketingSurface,
  marketingSurfaceSolid,
  marketingText,
} from '../components/marketing/MarketingChrome';

export default function HomePage() {
  const location = useLocation();
  useEffect(() => {
    const id = location.hash?.replace(/^#/, '');
    if (!id) return;
    const el = document.getElementById(id);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [location.hash, location.pathname]);

  return (
    <div
      className={`min-h-screen ${marketingBg} ${marketingText} antialiased font-sans selection:bg-[oklch(0.62_0.20_152/0.25)]`}
    >
      <MarketingHeader navItems={MARKETING_MAIN_NAV} />

      <main>
        <section
          id="sobre"
          className="mx-auto max-w-7xl px-5 pt-14 pb-16 lg:px-8 lg:pt-20 lg:pb-24 scroll-mt-24"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[oklch(0.62_0.20_152/0.35)] bg-[oklch(0.62_0.20_152/0.12)] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.62_0.20_152)] animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.62_0.20_152)]">
              Copy trading Bullex
            </span>
          </div>

          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 lg:items-end">
            <h1 className="font-display text-[clamp(2.25rem,6vw,4.25rem)] font-bold leading-[1.05] tracking-[-0.03em] text-[oklch(0.94_0.006_155)]">
              Transforme como você{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, oklch(0.72 0.22 152), oklch(0.65 0.20 175))',
                }}
              >
                replica
              </span>{' '}
              operações.
            </h1>

            <div className="space-y-8">
              <p className={`text-base leading-relaxed ${marketingMuted} lg:text-lg`}>
                Nossa solução integra operador e seguidores na Bullex: o master conecta a conta, os seguidores usam o
                portal dedicado com limites claros. Foque em escalar o copy — nós cuidamos da sincronização, segurança e
                visão por conta.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition hover:brightness-110 bg-[oklch(0.62_0.20_152)]"
                  style={{ boxShadow: '0 8px 32px oklch(0.62 0.20 152 / 0.35)' }}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                  Começar agora
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          id="destaque"
          className="mx-auto max-w-7xl px-5 pb-20 lg:px-8 lg:pb-28 scroll-mt-24"
        >
          <div
            className={`overflow-hidden rounded-[2rem] border ${marketingBorderSubtle} ${marketingSurface} backdrop-blur-2xl p-5 shadow-2xl shadow-black/40 lg:p-8`}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
              <div className="flex flex-col gap-5 lg:w-[min(100%,280px)] shrink-0">
                <div className={`rounded-2xl border ${marketingBorderSubtle} ${marketingSurfaceSolid} backdrop-blur-xl p-5`}>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {[
                        'bg-[oklch(0.62_0.20_152/0.75)]',
                        'bg-[oklch(0.65_0.18_175/0.7)]',
                        'bg-[oklch(0.55_0.14_200/0.65)]',
                        'bg-[oklch(0.52_0.12_160/0.7)]',
                      ].map((c, i) => (
                        <span
                          key={i}
                          className={`inline-flex h-9 w-9 rounded-full border-2 border-[#2A3544] ${c}`}
                        />
                      ))}
                    </div>
                    <p className="text-sm font-semibold text-[oklch(0.94_0.006_155)]">+ operadores ativos</p>
                  </div>
                  <p className={`mt-2 text-xs ${marketingMuted}`}>Rede de copy em crescimento na plataforma.</p>
                </div>

                <div className={`rounded-2xl border ${marketingBorderSubtle} ${marketingSurfaceSolid} backdrop-blur-xl p-5 flex-1`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm font-medium ${marketingMuted}`}>Mais eficiente</p>
                      <p className="mt-3 font-display text-4xl font-bold tracking-tight text-[oklch(0.94_0.006_155)]">
                        67%
                      </p>
                    </div>
                    <span className="rounded-full bg-[oklch(0.62_0.20_152/0.2)] px-2.5 py-1 text-xs font-bold text-[oklch(0.72_0.22_152)]">
                      + 6.73%
                    </span>
                  </div>
                  <div className="mt-6 flex h-24 items-end justify-between gap-1 px-1">
                    {[40, 65, 45, 80, 55, 90, 70, 95, 60, 85, 75, 100].map((h, i) => (
                      <span
                        key={i}
                        className="flex-1 max-w-[10px] rounded-t-sm bg-[oklch(0.94_0.006_155)]/85"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div
                className={`relative min-h-[280px] flex-1 overflow-hidden rounded-2xl border ${marketingBorderSubtle} bg-[#141A22] lg:min-h-[340px]`}
              >
                <div
                  className="absolute inset-0 opacity-95"
                  style={{
                    background: `
                      radial-gradient(ellipse 80% 60% at 30% 40%, oklch(0.62 0.20 152 / 0.22), transparent 52%),
                      radial-gradient(ellipse 70% 50% at 70% 60%, oklch(0.65 0.20 175 / 0.12), transparent 45%),
                      linear-gradient(135deg, #212B36 0%, #161C24 45%, #1A222D 100%)
                    `,
                  }}
                />
                <div
                  className="absolute -right-1/4 top-1/2 h-[140%] w-[70%] -translate-y-1/2 rounded-full blur-3xl"
                  style={{ background: 'linear-gradient(120deg, oklch(0.62 0.20 152 / 0.2), transparent 60%)' }}
                />
                <div
                  className="absolute left-1/4 bottom-0 h-[60%] w-[50%] rounded-full blur-2xl opacity-50"
                  style={{ background: 'linear-gradient(0deg, oklch(0.94 0.006 155 / 0.05), transparent)' }}
                />

                <div className="absolute right-4 top-4 z-10 flex flex-col gap-3 sm:right-6 sm:top-6 lg:right-8 lg:top-8 max-w-[calc(100%-2rem)]">
                  <div
                    className={`w-[200px] max-w-full rounded-2xl border ${marketingBorderSubtle} p-4 backdrop-blur-2xl sm:w-[220px] ${marketingSurface}`}
                  >
                    <p className={`text-[10px] font-semibold uppercase tracking-wide ${marketingMuted}`}>Sincronização</p>
                    <p className="mt-1 font-display text-3xl font-bold text-[oklch(0.94_0.006_155)]">97%</p>
                    <p className={`text-xs ${marketingMuted}`}>Último período</p>
                    <svg
                      className="mt-3 h-10 w-full text-[oklch(0.62_0.20_152)]"
                      viewBox="0 0 120 32"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M0 24 L20 18 L40 22 L60 8 L80 14 L100 4 L120 10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  </div>
                  <div
                    className={`w-[200px] max-w-full rounded-2xl border ${marketingBorderSubtle} p-4 backdrop-blur-2xl sm:w-[220px] ${marketingSurface}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-[10px] font-semibold uppercase tracking-wide ${marketingMuted}`}>Volume copy</p>
                        <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[oklch(0.94_0.006_155)]">
                          R$ 8.859
                        </p>
                        <p className={`text-xs ${marketingMuted}`}>Exemplo ilustrativo</p>
                      </div>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[oklch(0.62_0.20_152)] text-white">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <div className="h-full w-[72%] rounded-full bg-[oklch(0.62_0.20_152)]" />
                    </div>
                  </div>
                </div>

                <div
                  className={`absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-full border ${marketingBorderSubtle} bg-black/30 px-3 py-2 backdrop-blur-sm sm:bottom-6 sm:left-6`}
                >
                  <Zap className="h-4 w-4 text-[oklch(0.62_0.20_152)]" fill="currentColor" />
                  <span className={`text-xs font-medium ${marketingMuted}`}>Bullex · tempo real</span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 border-t border-white/[0.06] pt-8 sm:grid-cols-3">
              {[
                {
                  icon: LayoutDashboard,
                  t: 'Painel master',
                  d: 'Conexão Bullex, copy on/off e visão dos seguidores.',
                },
                { icon: Users, t: 'Portal do seguidor', d: 'Link exclusivo, modos de cópia e stop win/loss.' },
                { icon: Zap, t: 'Segurança', d: 'Credenciais protegidas e acesso liberado pelo admin.' },
              ].map(({ icon: Icon, t, d }) => (
                <div
                  key={t}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 transition hover:border-[oklch(0.62_0.20_152/0.35)]"
                >
                  <Icon className="h-5 w-5 text-[oklch(0.62_0.20_152)]" />
                  <h3 className="mt-3 font-display text-base font-bold text-[oklch(0.94_0.006_155)]">{t}</h3>
                  <p className={`mt-1.5 text-sm ${marketingMuted} leading-relaxed`}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="contato"
          className={`border-t ${marketingBorderSubtle} bg-[#161C24] px-5 py-16 lg:px-8 scroll-mt-24`}
        >
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[oklch(0.94_0.006_155)] sm:text-3xl">
              Pronto para operar com copy?
            </h2>
            <p className={`mt-3 ${marketingMuted}`}>
              Seguidores: usem o link do operador. Operadores: acessem com a conta criada pelo administrador.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition hover:brightness-110 bg-[oklch(0.62_0.20_152)]"
                style={{ boxShadow: '0 8px 32px oklch(0.62 0.20 152 / 0.35)' }}
              >
                Acessar painel
              </Link>
            </div>
          </div>
        </section>

        <MarketingFooter />
      </main>
    </div>
  );
}
