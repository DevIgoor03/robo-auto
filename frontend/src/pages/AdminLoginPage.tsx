import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { CopyFyLogo } from '../components/brand/CopyFyLogo';
import { authApi, tokenStore } from '../services/api';
import toast from 'react-hot-toast';

export default function AdminLoginPage() {
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
      if (data.user?.role !== 'ADMIN') {
        toast.error('Esta conta não é super admin.');
        return;
      }
      tokenStore.setTokens(data.accessToken, data.refreshToken);
      tokenStore.setUser(data.user);
      toast.success(`Bem-vindo, ${data.user.name}`);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? err.message ?? 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'w-full h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 ' +
    'placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.62_0.20_152)]/40 focus:border-[oklch(0.62_0.20_152)] transition-colors';

  return (
    <div className="login-auth-shell dark min-h-screen bg-[#161C24] text-[#F1F5F9] flex items-center justify-center px-4 antialiased font-sans">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[400px] h-[400px] rounded-full bg-[oklch(0.62_0.20_152)]/6 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-[oklch(0.62_0.20_152)]/4 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm z-10">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4">
            <CopyFyLogo
              iconClassName="h-12 w-auto"
              wordmarkClassName="font-display text-2xl font-bold tracking-tight text-[oklch(0.94_0.006_155)]"
            />
          </div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-[oklch(0.94_0.006_155)]">
            Super administrador
          </h1>
          <p className="mt-1 text-sm text-[oklch(0.52_0.018_152)]">Acesso restrito à plataforma</p>
        </div>

        <div className="relative bg-[#212B36]/90 backdrop-blur-xl border border-white/[0.1] rounded-2xl p-7 shadow-2xl shadow-black/30">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.62_0.20_152)]/40 to-transparent rounded-full" />

          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-[oklch(0.62_0.20_152)]/10 border border-[oklch(0.62_0.20_152)]/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-[oklch(0.62_0.20_152)]" />
            </div>
            <div>
              <p className="text-sm font-semibold">Acesso restrito</p>
              <p className="text-xs text-[oklch(0.52_0.018_152)]">
                Gerir operadores, portais e limites do Robô Auto
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[oklch(0.52_0.018_152)]">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoFocus
                placeholder="admin@empresa.com"
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[oklch(0.52_0.018_152)]">Senha</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  className={`${fieldClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 transition-colors"
                  tabIndex={-1}
                  aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white
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
                  <Lock className="w-4 h-4" />
                  Entrar no Painel
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[oklch(0.52_0.018_152)] mt-6">
          ←{' '}
          <Link to="/login" className="hover:text-[oklch(0.94_0.006_155)] transition-colors underline underline-offset-4">
            Voltar ao login do operador
          </Link>
        </p>
      </div>
    </div>
  );
}
