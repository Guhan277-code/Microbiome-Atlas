import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, UserRound } from 'lucide-react'
import { useApp } from '../store'
import { Btn, Card, Field, Logo, ThemeSwitch } from '../ui'
import {
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
  updateUserPassword,
  isSupabaseConfigured,
  supabaseConfigError,
} from '../lib/supabase'

function readAuthCallbackError(): string {
  if (typeof window === 'undefined') return ''
  const raw = (window.location.hash || '').replace(/^#\/?/, '')
  const search = (window.location.search || '').replace(/^\?/, '')
  for (const qs of [raw, search]) {
    if (!qs || !qs.includes('=')) continue
    const params = new URLSearchParams(qs)
    const desc = params.get('error_description') || params.get('error')
    if (desc) return desc
  }
  return ''
}

export default function Auth({ mode }: { mode: 'signin' | 'signup' | 'forgot' | 'recovery' }) {
  const { go, signIn, signOut, clearRecoveryMode, notify, redirectAfterAuth, setRedirectAfterAuth } = useApp()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState(() => readAuthCallbackError())
  const [loading, setLoading] = useState(false)
  const [infoMsg, setInfoMsg] = useState('')

  useEffect(() => {
    const callbackErr = readAuthCallbackError()
    if (callbackErr) setErr(callbackErr)
  }, [mode])

  const title =
    mode === 'signin'
      ? 'Sign in'
      : mode === 'signup'
        ? 'Create account'
        : mode === 'recovery'
          ? 'Set new password'
          : 'Reset password'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setInfoMsg('')

    if (!isSupabaseConfigured) {
      return setErr(
        supabaseConfigError ||
          'Supabase authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local or continue as Guest.',
      )
    }

    if (mode === 'recovery') {
      if (pw.length < 6) {
        return setErr('New password must be at least 6 characters.')
      }
      if (pw !== pwConfirm) {
        return setErr('Passwords do not match.')
      }
      setLoading(true)
      try {
        await updateUserPassword(pw)
        clearRecoveryMode()
        setRedirectAfterAuth(null)
        notify('info', 'Your password has been updated.')
        go('/app/overview')
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Could not update password. Please try again.'
        setErr(message)
      } finally {
        setLoading(false)
      }
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return setErr('Enter a valid email address in the form name@example.com.')
    }

    if (mode === 'forgot') {
      try {
        setLoading(true)
        await resetPassword(email.trim())
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
        const cleanEmail = email.trim()
        const data = await signUpWithEmail(cleanEmail, pw, name.trim())
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setErr('An account with this email already exists. Please sign in or reset your password.')
          return
        }
        if (data.session && data.user) {
          const displayName = (data.user.user_metadata?.display_name as string | undefined) || name.trim() || cleanEmail.split('@')[0]
          const nextRoute = redirectAfterAuth || '/new/upload'
          setRedirectAfterAuth(null)
          signIn(displayName, false, data.user.email, data.user.id)
          notify('info', `Account created! Welcome, ${displayName}.`)
          go(nextRoute)
        } else if (data.user) {
          setInfoMsg('Account created! Please check your email to confirm your account, then sign in.')
          notify('info', 'Confirmation email sent. Please verify before signing in.')
        }
      } else {
        const cleanEmail = email.trim()
        const data = await signInWithEmail(cleanEmail, pw)
        if (data.user) {
          const displayName = (data.user.user_metadata?.display_name as string | undefined) || cleanEmail.split('@')[0]
          const nextRoute = redirectAfterAuth || '/app/overview'
          setRedirectAfterAuth(null)
          signIn(displayName, false, data.user.email, data.user.id)
          notify('info', `Welcome back, ${displayName}!`)
          go(nextRoute)
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
            <span>
              {isSupabaseConfigured
                ? 'Connected to Supabase authentication and secure Row Level Security storage.'
                : 'Supabase is not configured (.env.local missing). Account sign-in is unavailable; you can still explore with a local guest session.'}
            </span>
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
              {mode !== 'recovery' && (
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
              )}
              {mode !== 'forgot' && (
                <Field label={mode === 'recovery' ? 'New password' : 'Password'}>
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
              {mode === 'recovery' && (
                <Field label="Confirm new password">
                  <input
                    type="password"
                    className="input"
                    value={pwConfirm}
                    onChange={(e) => { setPwConfirm(e.target.value); setErr('') }}
                    autoComplete="new-password"
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
                ) : mode === 'recovery' ? (
                  'Update password'
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

              {mode === 'recovery' && (
                <button
                  type="button"
                  onClick={() => { clearRecoveryMode(); void signOut() }}
                  className="block w-full text-center text-sm text-muted hover:text-ink hover:underline"
                >
                  Cancel and sign out
                </button>
              )}
            </form>
          )}

          {mode !== 'recovery' && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-faint">
                <i className="h-px flex-1 bg-line" />or<i className="h-px flex-1 bg-line" />
              </div>

              <Btn
                className="w-full"
                onClick={() => {
                  const nextRoute = redirectAfterAuth || '/new/upload'
                  setRedirectAfterAuth(null)
                  signIn('Guest Researcher', true)
                  go(nextRoute)
                }}
                disabled={loading}
              >
                <UserRound size={16} /> Continue as Guest (Local Session)
              </Btn>
            </>
          )}

          {mode !== 'recovery' && (
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
          )}
        </Card>
      </div>
    </div>
  )
}
