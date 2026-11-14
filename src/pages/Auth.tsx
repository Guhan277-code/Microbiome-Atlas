import { useState } from 'react'
import { ArrowLeft, Info, UserRound } from 'lucide-react'
import { useApp } from '../store'
import { Btn, Card, Field, Logo, ThemeSwitch } from '../ui'

export default function Auth({ mode }: { mode: 'signin' | 'signup' | 'forgot' }) {
  const { go, signIn, notify } = useApp()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const title = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter an email address in the form name@example.com.')
    if (mode === 'forgot') return setSent(true)
    if (pw.length < 6) return setErr('Use at least 6 characters for the prototype password field.')
    signIn(mode === 'signup' && name ? name : email.split('@')[0], false)
    notify('info', 'Signed in to the prototype session (no real authentication).')
    go('/new/upload')
  }
  return (
    <div className="page-in grid min-h-screen place-items-center p-4">
      <div className="absolute top-4 right-4"><ThemeSwitch /></div>
      <div className="w-full max-w-md">
        <button onClick={() => go('/')} className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={15} /> Back to home</button>
        <Card lift={false} className="p-7">
          <Logo />
          <h1 className="mt-6 text-2xl font-extrabold">{title}</h1>
          <div className="mt-3 flex gap-2 rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs text-muted"><Info size={16} className="shrink-0 text-warn" /><span><b>Prototype screen.</b> No account is created and nothing is authenticated, sent or stored. Any valid-looking details open a local demo session.</span></div>
          {sent ? (
            <div className="mt-6 space-y-4"><p className="sci text-sm text-muted">Prototype only: no email was sent. In a connected product, reset instructions would arrive at <b className="mono">{email}</b>.</p><Btn className="w-full" onClick={() => go('/signin')}>Back to sign in</Btn></div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === 'signup' && <Field label="Full name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>}
              <Field label="Email"><input className="input" value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }} autoComplete="email" inputMode="email" /></Field>
              {mode !== 'forgot' && <Field label="Password"><input type="password" className="input" value={pw} onChange={(e) => { setPw(e.target.value); setErr('') }} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></Field>}
              {err && <p role="alert" className="text-sm text-bad">{err}</p>}
              <Btn variant="primary" type="submit" className="w-full">{mode === 'forgot' ? 'Send reset link (demo)' : title}</Btn>
              {mode === 'signin' && <button type="button" onClick={() => go('/forgot')} className="block w-full text-center text-sm text-brand hover:underline">Forgot password?</button>}
            </form>
          )}
          <div className="my-5 flex items-center gap-3 text-xs text-faint"><i className="h-px flex-1 bg-line" />or<i className="h-px flex-1 bg-line" /></div>
          <Btn className="w-full" onClick={() => { signIn('Guest Researcher', true); go('/new/upload') }}><UserRound size={16} /> Continue as Guest</Btn>
          <p className="mt-5 text-center text-sm text-muted">
            {mode === 'signin' ? <>New here? <button className="text-brand hover:underline" onClick={() => go('/signup')}>Create account</button></> : <>Already registered? <button className="text-brand hover:underline" onClick={() => go('/signin')}>Sign in</button></>}
          </p>
        </Card>
      </div>
    </div>
  )
}
