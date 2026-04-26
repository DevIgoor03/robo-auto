import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  GitBranch,
  LayoutDashboard,
  Lock,
  Radio,
  Scale,
  Shield,
  Sparkles,
  Target,
  Users,
  Wallet,
} from 'lucide-react';
import {
  MARKETING_MAIN_NAV,
  MarketingFooter,
  MarketingHeader,
  marketingBg,
  marketingBorderSubtle,
  marketingMuted,
  marketingSurface,
  marketingText,
} from '../components/marketing/MarketingChrome';

const cardClass = `rounded-2xl border ${marketingBorderSubtle} ${marketingSurface} backdrop-blur-2xl`;
const gradientTop =
  'absolute inset-x-8 top-0 h-px rounded-full pointer-events-none bg-gradient-to-r from-transparent via-[oklch(0.62_0.20_152/0.55)] to-transparent';

export default function CopyTradingGuidePage() {
  return (
    <div
      className={`min-h-screen ${marketingBg} ${marketingText} antialiased font-sans selection:bg-[oklch(0.62_0.20_152/0.25)]`}
    >
      <MarketingHeader navItems={MARKETING_MAIN_NAV} />

      <main className="mx-auto max-w-4xl px-5 py-14 lg:px-8 lg:py-20">
        <header className="mb-14 scroll-mt-28 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.62_0.20_152/0.35)] bg-[oklch(0.62_0.20_152/0.12)] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.62_0.20_152)] animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.62_0.20_152)]">
              Guia completo
            </span>
          </div>
          <h1 className="font-display text-[clamp(1.85rem,4.5vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[oklch(0.94_0.006_155)]">
            O que é{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(135deg, oklch(0.72 0.22 152), oklch(0.65 0.20 175))',
              }}
            >
              copy trading
            </span>{' '}
            e como funciona no Robô Auto
          </h1>
          <p className={`text-base leading-relaxed ${marketingMuted} max-w-2xl`}>
            Copy trading é replicar automaticamente as operações de um trader nas contas de quem o segue. Aqui, tudo
            passa pela <strong className="text-[oklch(0.94_0.006_155)]/90 font-semibold">Bullex</strong>: painel para o
            operador e portal dedicado para cada seguidor.
          </p>
        </header>

        <div className="space-y-10 lg:space-y-14">
          <section id="o-que-e" className={`relative overflow-hidden ${cardClass} p-8 scroll-mt-28`}>
            <div className={gradientTop} />
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.62_0.20_152/0.15)]">
                <BookOpen className="h-5 w-5 text-[oklch(0.62_0.20_152)]" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-[oklch(0.94_0.006_155)]">
                  Em uma frase
                </h2>
                <p className={`mt-1 text-sm ${marketingMuted}`}>Conceito central</p>
                <p className={`mt-4 leading-relaxed ${marketingMuted}`}>
                  Quando o <strong className="text-[oklch(0.94_0.006_155)]/85">operador master</strong> abre ou fecha
                  uma posição na corretora, o sistema pode replicar nas contas dos{' '}
                  <strong className="text-[oklch(0.94_0.006_155)]/85">seguidores</strong>, respeitando regras e limites.
                  Você não copia cada ordem à mão: a plataforma faz a ponte entre as contas.
                </p>
              </div>
            </div>
          </section>

          <section id="fluxo" className="scroll-mt-28">
            <h2 className="font-display text-xl font-bold text-[oklch(0.94_0.006_155)]">Fluxo típico</h2>
            <p className={`mt-2 text-sm ${marketingMuted}`}>Do cadastro à replicação.</p>
            <ol className="mt-8 space-y-4">
              {[
                {
                  step: '1',
                  title: 'Conexão do operador',
                  body: 'O master conecta a conta Bullex na plataforma e configura o copy no painel.',
                  icon: LayoutDashboard,
                },
                {
                  step: '2',
                  title: 'Seguidores autorizados',
                  body: 'O seguidor envia o email Bullex ao administrador, que libera o acesso ao portal daquele operador.',
                  icon: Shield,
                },
                {
                  step: '3',
                  title: 'Portal do seguidor',
                  body: 'Entrada pelo link exclusivo (/portal/…) com email e senha Bullex, ajuste de cópia e limites.',
                  icon: Users,
                },
                {
                  step: '4',
                  title: 'Replicação',
                  body: 'Com o copy ativo, novas operações do master podem ser replicadas conforme as regras definidas.',
                  icon: GitBranch,
                },
              ].map(({ step, title, body, icon: Icon }) => (
                <li
                  key={step}
                  className={`flex gap-4 rounded-2xl border ${marketingBorderSubtle} bg-white/[0.03] p-5`}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ background: 'oklch(0.62 0.20 152 / 0.35)' }}
                  >
                    {step}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[oklch(0.62_0.20_152)]" />
                      <h3 className="font-display font-semibold text-[oklch(0.94_0.006_155)]">{title}</h3>
                    </div>
                    <p className={`mt-2 text-sm leading-relaxed ${marketingMuted}`}>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="perfis" className="scroll-mt-28">
            <h2 className="font-display text-xl font-bold text-[oklch(0.94_0.006_155)]">Dois tipos de usuário</h2>
            <p className={`mt-2 text-sm ${marketingMuted}`}>Mesma plataforma, papéis diferentes.</p>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className={`relative overflow-hidden ${cardClass} p-7`}>
                <div className={gradientTop} />
                <LayoutDashboard className="h-8 w-8 text-[oklch(0.62_0.20_152)]" />
                <h3 className="mt-4 font-display text-lg font-bold">Operador (master)</h3>
                <ul className={`mt-3 space-y-2.5 text-sm leading-relaxed ${marketingMuted}`}>
                  <li className="flex gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.62_0.20_152)]" />
                    Painel em <span className="font-mono text-[oklch(0.62_0.20_152)]">/login</span> — credenciais criadas pelo admin.
                  </li>
                  <li className="flex gap-2">
                    <Radio className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.62_0.20_152)]" />
                    Conecta a Bullex, liga ou pausa o copy e acompanha seguidores.
                  </li>
                </ul>
              </div>
              <div className={`relative overflow-hidden ${cardClass} p-7`}>
                <div className={gradientTop} />
                <Users className="h-8 w-8 text-[oklch(0.65_0.18_175)]" />
                <h3 className="mt-4 font-display text-lg font-bold">Seguidor</h3>
                <ul className={`mt-3 space-y-2.5 text-sm leading-relaxed ${marketingMuted}`}>
                  <li className="flex gap-2">
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.65_0.18_175)]" />
                    Usa o link do operador (<span className="font-mono text-[oklch(0.62_0.20_152)]">/portal/…</span>), não o login master.
                  </li>
                  <li className="flex gap-2">
                    <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.65_0.18_175)]" />
                    Define valores, conta real/demo, stop win/loss e ativação do copy.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section id="plataforma" className="scroll-mt-28">
            <h2 className="font-display text-xl font-bold text-[oklch(0.94_0.006_155)]">O que a plataforma oferece</h2>
            <p className={`mt-2 text-sm ${marketingMuted}`}>Recursos do dia a dia.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: GitBranch,
                  t: 'Modos de cópia',
                  d: 'Valor fixo, multiplicador ou proporcional ao saldo.',
                },
                { icon: Scale, t: 'Stop win e stop loss', d: 'Limites por seguidor para encerrar com regras claras.' },
                { icon: Lock, t: 'Credenciais', d: 'Armazenamento seguro; acesso ao portal controlado pelo admin.' },
                { icon: Radio, t: 'Tempo real', d: 'Operações e estatísticas na interface do seguidor.' },
              ].map(({ icon: Icon, t, d }) => (
                <div
                  key={t}
                  className={`flex gap-4 rounded-2xl border ${marketingBorderSubtle} bg-white/[0.03] p-5`}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[oklch(0.62_0.20_152)]" />
                  <div>
                    <h3 className="font-semibold text-sm text-[oklch(0.94_0.006_155)]">{t}</h3>
                    <p className={`mt-1 text-xs leading-relaxed ${marketingMuted}`}>{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="faq" className={`relative scroll-mt-28 overflow-hidden ${cardClass} p-8`}>
            <div className={gradientTop} />
            <h2 className="font-display text-xl font-bold text-[oklch(0.94_0.006_155)]">Perguntas frequentes</h2>
            <dl className="mt-8 space-y-6">
              {[
                {
                  q: 'Copy trading garante lucro?',
                  a: 'Não. É ferramenta de execução: resultados dependem do mercado, da estratégia e das configurações. Há risco de perda.',
                },
                {
                  q: 'Preciso usar minha senha Bullex?',
                  a: 'Para replicar ordens é necessário autenticar na corretora com segurança. Use só links oficiais do operador.',
                },
                {
                  q: 'Por que não consigo entrar no portal?',
                  a: 'O email Bullex precisa estar liberado pelo administrador para aquele operador. Envie o email correto ao suporte após a compra.',
                },
                {
                  q: 'O master vê minha senha?',
                  a: 'O desenho típico isola credenciais; o operador foca na gestão do copy. Em dúvida, confirme com quem te convidou.',
                },
              ].map(({ q, a }) => (
                <div key={q}>
                  <dt className="text-sm font-semibold text-[oklch(0.94_0.006_155)]">{q}</dt>
                  <dd className={`mt-2 text-sm leading-relaxed ${marketingMuted}`}>{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section
            className={`relative overflow-hidden rounded-2xl border ${marketingBorderSubtle} px-8 py-12 text-center`}
            style={{
              background:
                'linear-gradient(145deg, oklch(0.12 0.02 155), oklch(0.08 0.02 152))',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background: 'radial-gradient(ellipse at 50% 0%, oklch(0.62 0.20 152 / 0.22), transparent 55%)',
              }}
            />
            <div className="relative">
              <h2 className="font-display text-2xl font-bold tracking-tight text-[oklch(0.94_0.006_155)]">
                Pronto para começar?
              </h2>
              <p className={`mx-auto mt-3 max-w-md text-sm leading-relaxed ${marketingMuted}`}>
                Operadores: painel em /login. Seguidores: link do operador e email Bullex liberado.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition hover:brightness-110 bg-[oklch(0.62_0.20_152)]"
                  style={{ boxShadow: '0 8px 32px oklch(0.62 0.20 152 / 0.35)' }}
                >
                  Acessar painel
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/"
                  className={`inline-flex items-center justify-center rounded-xl border ${marketingBorderSubtle} px-8 py-3.5 text-sm font-semibold text-[oklch(0.94_0.006_155)] transition hover:bg-white/[0.06]`}
                >
                  Voltar ao início
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
