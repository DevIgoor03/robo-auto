import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authApi, tokenStore } from '../services/api';
import toast from 'react-hot-toast';
import { InviteBullAuthShell } from '../components/login/InviteBullAuthShell';

const TICKER = [
  'Copy trading em tempo real',
  'Replicação automática para seguidores',
  'Stop win e stop loss',
  'Portal dedicado aos seguidores',
  'Integração com a Bullex',
  'Credenciais encriptadas',
];

/* Fundo claro + texto escuro: contraste garantido (evita autofill + tema dark no html). */
const inputClass =
  'w-full h-12 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 ' +
  'placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.62_0.20_152)]/35 focus:border-[oklch(0.62_0.20_152)] transition-colors';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      tokenStore.setTokens(data.accessToken, data.refreshToken);
      tokenStore.setUser(data.user);

      if (data.user?.role === 'ADMIN') {
        toast.success(`Olá, ${data.user.name}`);
        navigate('/admin', { replace: true });
        return;
      }
      toast.success(`Bem-vindo, ${data.user.name}!`);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Erro ao autenticar';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const grid = (
    <div className="w-full max-w-7xl mx-auto grid lg:grid-cols-[1fr_400px] gap-12 lg:gap-20 items-center">
      <div className="animate-invite-float-up" style={{ animationDelay: '0.1s' }}>
        <div className="inline-flex items-center gap-2 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.62_0.20_152)] animate-pulse" />
          <span className="text-xs font-semibold text-[#B4C0CE] tracking-[0.15em] uppercase">
            Copy trading profissional · v2.0
          </span>
        </div>

        <h1 className="font-display font-bold leading-[0.92] tracking-[-0.04em] mb-8">
          <span className="block text-[clamp(2.5rem,8vw,7rem)] text-[#F1F5F9]">Replique.</span>
          <span
            className="block text-[clamp(2.5rem,8vw,7rem)]"
            style={{
              background: 'linear-gradient(135deg, oklch(0.72 0.22 152), oklch(0.65 0.20 175))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Escale.
          </span>
          <span className="block text-[clamp(2.5rem,8vw,7rem)] text-[#F1F5F9]/30">Vença.</span>
        </h1>

        <div className="flex items-start gap-6">
          <div
            className="w-px h-16 shrink-0 mt-1"
            style={{
              background: 'linear-gradient(to bottom, oklch(0.62 0.20 152 / 0.6), transparent)',
            }}
          />
          <p className="text-base text-[#B4C0CE] leading-relaxed max-w-sm">
            Conecte a sua conta na Bullex, convide seguidores pelo portal e acompanhe as operações replicadas em tempo real — com
            stop win, stop loss e contas isoladas por seguidor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-8 sm:gap-10 mt-10">
          {[
            { value: '24/7', label: 'Sincronização' },
            { value: '100%', label: 'Replicação' },
            { value: 'Bullex', label: 'Corretora' },
          ].map(({ value, label }, i) => (
            <div key={label} className="animate-invite-float-up" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
              <p className="font-display text-2xl font-bold tracking-tight text-[#F1F5F9]">{value}</p>
              <p className="text-xs text-[#B4C0CE] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-invite-float-up" style={{ animationDelay: '0.25s' }}>
        <div className="relative">
          <div
            className="absolute inset-0 rounded-3xl blur-2xl -z-10 scale-95"
            style={{ background: 'oklch(0.38 0.18 152 / 0.12)' }}
          />
          <div className="relative bg-[#212B36]/88 backdrop-blur-2xl border border-white/[0.1] rounded-3xl p-8 overflow-hidden">
            <div
              className="absolute inset-x-8 top-0 h-px rounded-full pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, oklch(0.62 0.20 152 / 0.6), transparent)',
              }}
            />

            <div className="mb-7 relative">
              <p className="text-xs text-[#B4C0CE] tracking-[0.1em] uppercase font-semibold mb-2">
                Acesse o seu painel
              </p>
              <h2 className="font-display text-xl font-bold tracking-tight text-[#F1F5F9]">
                Bem-vindo de volta
              </h2>
              <p className="text-xs text-[#B4C0CE] mt-2 leading-relaxed">
                Área do operador master. As credenciais são criadas pelo administrador da plataforma Robô Auto.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 relative">
              <div>
                <label className="block text-xs font-semibold text-[#B4C0CE] mb-2 tracking-wide">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  disabled={loading}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#B4C0CE] mb-2 tracking-wide">Senha</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={1}
                    disabled={loading}
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 transition-colors"
                    aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-2 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white
                           bg-[oklch(0.62_0.20_152)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 8px 32px oklch(0.62 0.20 152 / 0.35)' }}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    Entrar no Painel
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/[0.06] relative">
              <p className="text-xs text-[#B4C0CE] text-center leading-relaxed">
                Não possui credenciais? Entre em contato com o{' '}
                <span className="text-[#F1F5F9]/60 font-medium">administrador</span> da plataforma.
              </p>
              <p className="text-center text-xs text-[#B4C0CE] mt-4 leading-relaxed">
                É seguidor? Utilize o link pessoal que o seu operador enviou (ex.:{' '}
                <span className="font-mono text-[oklch(0.62_0.20_152)]">…/portal/o-seu-link</span>
                ).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <InviteBullAuthShell
      logoTo="/"
      navLinks={[{ to: '/', label: 'Início' }]}
      adminLink={null}
      tickerItems={TICKER}
    >
      {grid}
    </InviteBullAuthShell>
  );
}
