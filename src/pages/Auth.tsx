import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, UserRound } from 'lucide-react'
import { useApp } from '../store'
import { Btn, Card, Field, Logo, ThemeSwitch } from '../ui'
import { signInWithEmail, signUpWithEmail, resetPassword } from '../lib/supabase'

export default function Auth({ mode }: { mode: 'signin' | 'signup' | 'forgot' }) {
  const { go, signIn, notify, redirectAfterAuth } = useApp()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [infoMsg, setInfoMsg] = useState('')

  const title = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setInfoMsg('')

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return setErr('Enter a valid email address in the form name@example.com.')
    }

    if (mode === 'forgot') {
      try {
        setLoading(true)
        await resetPassword(email)
        setSent(true)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Could not send reset link. Please try again.'
        setErr(message)
      } finally {
        setLoading(false)
      }
      return
    }

    if (pw.length < 6) {
      return setErr('Password must be at least 6 characters.')
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const data = await signUpWithEmail(email, pw, name.trim())
        if (data.session) {
          notify('info', `Account created! Welcome, ${name || email.split('@')[0]}.`)
          go(redirectAfterAuth || '/new/upload')
        } else if (data.user) {
          setInfoMsg('Account created! Please check your email to confirm your account, then sign in.')
          notify('info', 'Confirmation email sent. Please verify before signing in.')
        }
      } else {
        const data = await signInWithEmail(email, pw)
        if (data.user) {
          notify('info', `Welcome back, ${data.user.user_metadata?.display_name || email.split('@')[0]}!`)
          go(redirectAfterAuth || '/app/overview')
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed. Please verify your credentials.'
      setErr(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-in grid min-h-screen place-items-center p-4">
      <div className="absolute top-4 right-4"><ThemeSwitch /></div>
      <div className="w-full max-w-md">
        <button onClick={() => go('/')} className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> Back to home
        </button>
        <Card lift={false} className="p-7">
          <Logo />
          <h1 className="mt-6 text-2xl font-extrabold">{title}</h1>
          <div className="mt-3 flex gap-2 rounded-xl border border-brand/30 bg-brand/10 p-3 text-xs text-muted">
            <ShieldCheck size={16} className="shrink-0 text-cyan" />
            <span>Connected to Supabase authentication and secure Row Level Security storage.</span>
          </div>

          {sent ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-ok">
                <CheckCircle2 size={16} />
                <span>Password reset instructions have been sent to <b className="mono">{email}</b>.</span>
              </div>
              <p className="sci text-xs text-muted">
                Please check your inbox (and spam folder) for the password recovery link.
              </p>
              <Btn className="w-full" onClick={() => { setSent(false); go('/signin') }}>
                Back to sign in
              </Btn>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === 'signup' && (
                <Field label="Full name">
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="e.g. Dr. Jane Smith"
                    disabled={loading}
                  />
                </Field>
              )}
              <Field label="Email">
                <input
                  className="input"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErr('') }}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="name@university.edu"
                  disabled={loading}
                  required
                />
              </Field>
              {mode !== 'forgot' && (
                <Field label="Password">
                  <input
                    type="password"
                    className="input"
                    value={pw}
                    onChange={(e) => { setPw(e.target.value); setErr('') }}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    placeholder="••••••••"
                    disabled={loading}
                    required
                  />
                </Field>
              )}

              {infoMsg && (
                <div role="status" className="rounded-xl border border-ok/30 bg-ok/10 p-3 text-xs text-ok">
                  {infoMsg}
                </div>
              )}

              {err && <p role="alert" className="text-sm text-bad">{err}</p>}

              <Btn variant="primary" type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Processing...
                  </span>
                ) : mode === 'forgot' ? (
                  'Send reset link'
                ) : (
                  title
                )}
              </Btn>

              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => go('/forgot')}
                  className="block w-full text-center text-sm text-brand hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </form>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-faint">
            <i className="h-px flex-1 bg-line" />or<i className="h-px flex-1 bg-line" />
          </div>

          <Btn
            className="w-full"
            onClick={() => {
              signIn('Guest Researcher', true)
              go(redirectAfterAuth || '/new/upload')
            }}
            disabled={loading}
          >
            <UserRound size={16} /> Continue as Guest (Local Session)
          </Btn>

          <p className="mt-5 text-center text-sm text-muted">
            {mode === 'signin' ? (
              <>
                New here?{' '}
                <button className="text-brand hover:underline" onClick={() => go('/signup')}>
                  Create account
                </button>
              </>
            ) : (
              <>
                Already registered?{' '}
                <button className="text-brand hover:underline" onClick={() => go('/signin')}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </Card>
      </div>
    </div>
  )
}
