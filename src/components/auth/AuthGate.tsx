import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Session } from '@supabase/supabase-js';
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  KeyRound,
  Database,
  Sparkles,
  Cloud,
  Palette,
  Tag,
  CloudOff,
  Shield,
} from 'lucide-react';
import { getSupabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DonateButton } from '../ui/DonateButton';
import { Credit } from '../ui/Credit';
import { cn } from '../../lib/utils';

type Mode = 'sign-in' | 'sign-up';

interface AuthGateProps {
  onAuthenticated: (session: Session) => void;
  onSkipLocal: () => void;
}

export function AuthGate({ onAuthenticated, onSkipLocal }: AuthGateProps) {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabase();

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) onAuthenticated(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) onAuthenticated(session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SUPABASE_CONFIGURED) {
    return <SetupScreen onSkip={onSkipLocal} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'sign-up') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setError(
            'Account created! Check your email to confirm before signing in.',
          );
          setMode('sign-in');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Left side: branding + features */}
      <div className="hidden flex-1 flex-col justify-between p-12 lg:flex">
        <Brand />
        <div className="space-y-6">
          <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-text">
            Your private notebook,<br />beautifully synced.
          </h2>
          <p className="max-w-md text-[14px] leading-relaxed text-text-muted">
            A clean, distraction-free space to capture lectures and ideas. Rich
            text, 85+ themes, and zero clutter. Your notes sync automatically
            across all your devices.
          </p>
          <ul className="space-y-3">
            <Feature
              icon={<Sparkles size={14} />}
              title="Rich text editing"
              detail="Bold, lists, headings, quotes, and more — no Markdown knowledge needed."
            />
            <Feature
              icon={<Palette size={14} />}
              title="85+ themes"
              detail="Light, dark, colorful, seasonal. Make it yours."
            />
            <Feature
              icon={<Tag size={14} />}
              title="Subject organization"
              detail="Color-coded subjects to keep classes and projects sorted."
            />
            <Feature
              icon={<Shield size={14} />}
              title="Private & secure"
              detail="Row-level security scopes every note to your account."
            />
          </ul>
        </div>
        <div className="flex items-center justify-between">
          <Credit />
          <DonateButton size="sm" variant="subtle" />
        </div>
      </div>

      {/* Right side: sign-in form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="mb-6 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-4 flex items-center gap-3 lg:hidden">
              <Brand />
            </div>
            <motion.div
              initial={{ scale: 0.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.1 }}
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-[16px] bg-accent text-accent-text shadow-apple-lg lg:hidden"
            >
              <Sparkles size={26} />
            </motion.div>
            <h1 className="text-[28px] font-semibold tracking-tight text-text">
              {mode === 'sign-up' ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="mt-1.5 text-[14px] text-text-muted">
              {mode === 'sign-up'
                ? 'Save your notes and settings to the cloud.'
                : 'Sign in to sync your notes across devices.'}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-apple-xl glass-strong shadow-apple-lg overflow-hidden"
          >
            <div className="flex flex-col gap-3 p-5">
              <div className="flex gap-1 rounded-[10px] bg-surface-2 p-1">
                {(['sign-in', 'sign-up'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setError(null);
                    }}
                    className={cn(
                      'flex-1 rounded-[8px] py-1.5 text-[13px] font-medium transition-colors',
                      mode === m
                        ? 'bg-surface text-text shadow-apple'
                        : 'text-text-muted hover:text-text',
                    )}
                  >
                    {m === 'sign-up' ? 'Sign up' : 'Sign in'}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[12px] text-text-muted">
                  <Mail size={12} />
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[12px] text-text-muted">
                  <Lock size={12} />
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={
                    mode === 'sign-up' ? 'new-password' : 'current-password'
                  }
                  minLength={6}
                  required
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-[10px] border border-danger/30 bg-danger/10 px-3 py-2 text-[12.5px] text-danger"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading || !email || !password}
                className="mt-2 w-full"
                leadingIcon={
                  loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ArrowRight size={16} />
                  )
                }
              >
                {loading
                  ? '…'
                  : mode === 'sign-up'
                    ? 'Create account'
                    : 'Sign in'}
              </Button>
            </div>
          </form>

          <div className="mt-4 flex flex-col items-center gap-3">
            <p className="text-center text-[12px] text-text-subtle">
              Notes are scoped to your account via Supabase row-level security.
            </p>
            <DonateButton size="sm" variant="subtle" className="lg:hidden" />
            <Credit className="lg:hidden" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent text-accent-text shadow-apple">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>
      <span className="text-[17px] font-semibold tracking-tight text-text">
        Notes
      </span>
    </div>
  );
}

function Feature({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        {icon}
      </div>
      <div>
        <div className="text-[13.5px] font-medium text-text">{title}</div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-text-muted">
          {detail}
        </div>
      </div>
    </li>
  );
}

function SetupScreen({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-lg"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-[16px] bg-accent text-accent-text shadow-apple-lg"
          >
            <Cloud size={26} />
          </motion.div>
          <h1 className="text-[26px] font-semibold tracking-tight text-text">
            Set up cloud sync
          </h1>
          <p className="mt-1.5 max-w-sm text-[13.5px] text-text-muted">
            To save notes to the cloud, connect a Supabase project. Free tier
            is plenty for personal use.
          </p>
        </div>

        <div className="rounded-apple-xl glass-strong shadow-apple-lg overflow-hidden">
          <div className="flex flex-col gap-4 p-5">
            <Step
              n={1}
              icon={<Database size={13} />}
              title="Create a free Supabase project"
              detail="Sign up at supabase.com and create a new project."
            />
            <Step
              n={2}
              icon={<KeyRound size={13} />}
              title="Run the schema script"
              detail={
                <span>
                  In the SQL editor, paste and run{' '}
                  <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px] text-text">
                    supabase/schema.sql
                  </code>{' '}
                  from the project root.
                </span>
              }
            />
            <Step
              n={3}
              icon={<Sparkles size={13} />}
              title="Add your keys to .env"
              detail={
                <span>
                  Copy{' '}
                  <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px] text-text">
                    Project URL
                  </code>{' '}
                  and{' '}
                  <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px] text-text">
                    anon key
                  </code>{' '}
                  from Project Settings → API into{' '}
                  <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px] text-text">
                    .env
                  </code>
                  .
                </span>
              }
            />
            <Step
              n={4}
              icon={<ArrowRight size={13} />}
              title="Restart the dev server"
              detail="Restart Vite so the new env vars load. This screen will be replaced with sign-in."
            />

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button
                variant="secondary"
                onClick={onSkip}
                className="w-full"
                leadingIcon={<CloudOff size={14} />}
              >
                Continue with local-only
              </Button>
              <p className="text-center text-[11.5px] text-text-subtle">
                Local-only mode saves everything to your browser. You can wire
                up Supabase later by editing <code>.env</code> and reloading.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center gap-3">
          <DonateButton size="sm" variant="subtle" />
          <Credit />
        </div>
      </motion.div>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  detail,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  detail: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[12px] font-semibold text-accent">
        {n}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5 text-[13.5px] font-medium text-text">
          {icon}
          {title}
        </div>
        <div className="mt-0.5 text-[12.5px] leading-relaxed text-text-muted">
          {detail}
        </div>
      </div>
    </div>
  );
}