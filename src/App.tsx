import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'
import { Check, Info, Loader2, X } from 'lucide-react'
import { useApp } from './store'
import { Btn, TooltipLayer } from './ui'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Wizard from './pages/Wizard'
import Shell from './Shell'
import Overview from './pages/Overview'
import Datasets from './pages/Datasets'
import { Composition, Alpha, Beta } from './pages/Analysis1'
import { Taxonomy, Comparison, Advanced } from './pages/Analysis2'
import { Results, Reports } from './pages/Results'
import { Activity, Docs, Settings } from './pages/Misc'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center bg-solid p-4 text-ink">
          <div className="w-full max-w-md rounded-2xl border border-line p-6 text-center shadow-2xl" style={{ background: 'var(--bg)' }}>
            <h1 className="text-lg font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted">
              {this.state.error.message || 'An unexpected rendering error occurred in the workspace.'}
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Btn
                onClick={() => {
                  this.setState({ error: null })
                  location.hash = '/'
                }}
              >
                Return Home
              </Btn>
              <Btn variant="primary" onClick={() => window.location.reload()}>
                Reload App
              </Btn>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const PAGES: Record<string, () => React.ReactElement> = {
  overview: Overview,
  datasets: Datasets,
  composition: Composition,
  alpha: Alpha,
  beta: Beta,
  taxonomy: Taxonomy,
  comparison: Comparison,
  advanced: Advanced,
  results: Results,
  reports: Reports,
  activity: Activity,
  docs: Docs,
  settings: Settings,
}

function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  const Icon = toast.kind === 'error' ? X : toast.kind === 'info' ? Info : Check
  return (
    <div
      key={toast.id}
      role="status"
      className="pop fixed right-4 bottom-4 z-[95] flex max-w-sm items-start gap-3 rounded-2xl border border-line p-4 text-sm shadow-2xl"
      style={{ background: 'var(--solid)' }}
    >
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ${toast.kind === 'error' ? 'bg-bad' : toast.kind === 'info' ? 'bg-brand' : 'bg-ok'}`}
      >
        <Icon size={14} />
      </span>
      <span>{toast.text}</span>
    </div>
  )
}

export default function App() {
  const {
    path,
    go,
    user,
    authLoading,
    dataLoading,
    dataError,
    hydratedUserId,
    recoveryMode,
    retrySync,
    signOut,
    setRedirectAfterAuth,
  } = useApp()
  const parts = path.split('/').filter(Boolean)

  useEffect(() => {
    const t =
      {
        '': 'Microbiome Atlas — Explore the Hidden World of Microbes',
        app: 'Workspace — Microbiome Atlas',
        new: 'New analysis — Microbiome Atlas',
      }[parts[0] ?? ''] ?? 'Microbiome Atlas'
    document.title = t
  }, [parts])

  const isAuthCallback = /(?:^|\/|&)(?:access_token|refresh_token|type|error|error_description)=/.test(path)
  const hasCallbackError = /(?:^|\/|&)(?:error|error_description)=/.test(path)
  const isProtected = parts[0] === 'app' || parts[0] === 'new'
  const isUnknownRoute =
    !authLoading &&
    !recoveryMode &&
    parts.length > 0 &&
    !['signin', 'signup', 'forgot', 'new', 'app'].includes(parts[0]) &&
    !isAuthCallback

  useEffect(() => {
    if (!authLoading && !recoveryMode && isProtected && !user) {
      setRedirectAfterAuth(path)
      go('/signin')
    }
  }, [authLoading, recoveryMode, isProtected, user, path, setRedirectAfterAuth, go])

  useEffect(() => {
    if (isUnknownRoute) {
      go('/')
    } else if (isAuthCallback && !hasCallbackError && !authLoading && !recoveryMode) {
      go(user ? '/app/overview' : '/')
    }
  }, [isUnknownRoute, isAuthCallback, hasCallbackError, authLoading, recoveryMode, user, go])

  const waitingForData = Boolean(
    user && !user.guest && user.id && (dataLoading || (hydratedUserId !== user.id && !dataError)),
  )

  if (authLoading || (isProtected && waitingForData)) {
    return (
      <div className="grid min-h-screen place-items-center bg-solid text-muted">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-cyan" />
          <p className="text-sm">
            {authLoading ? 'Connecting to Microbiome Atlas...' : 'Synchronizing workspace datasets...'}
          </p>
        </div>
      </div>
    )
  }

  let view
  if (recoveryMode) {
    view = <Auth mode="recovery" />
  } else if (isAuthCallback && hasCallbackError) {
    view = <Auth mode="signin" />
  } else if (parts.length === 0) {
    view = <Landing />
  } else if (parts[0] === 'signin') {
    view = <Auth mode="signin" />
  } else if (parts[0] === 'signup') {
    view = <Auth mode="signup" />
  } else if (parts[0] === 'forgot') {
    view = <Auth mode="forgot" />
  } else if (parts[0] === 'new' || parts[0] === 'app') {
    if (!user) {
      view = null
    } else if (!user.guest && user.id && dataError && hydratedUserId !== user.id) {
      view = (
        <div className="grid min-h-screen place-items-center bg-solid p-4 text-ink">
          <div className="w-full max-w-md rounded-2xl border border-line p-6 text-center shadow-2xl" style={{ background: 'var(--bg)' }}>
            <h1 className="text-lg font-bold">Could not load workspace data</h1>
            <p className="mt-2 text-sm text-muted">{dataError}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Btn onClick={() => void signOut()}>Sign out</Btn>
              <Btn variant="primary" onClick={() => void retrySync()}>Retry sync</Btn>
            </div>
          </div>
        </div>
      )
    } else if (parts[0] === 'new') {
      view = <Wizard step={parts[1] ?? 'upload'} />
    } else {
      const id = PAGES[parts[1]] ? parts[1] : 'overview'
      const Page = PAGES[id]
      view = (
        <Shell page={id}>
          <Page />
        </Shell>
      )
    }
  } else {
    view = null
  }

  return (
    <ErrorBoundary>
      {view}
      <TooltipLayer />
      <Toast />
    </ErrorBoundary>
  )
}
