import { useEffect } from 'react'
import { Check, Info, Loader2, X } from 'lucide-react'
import { useApp } from './store'
import { TooltipLayer } from './ui'
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
  const { path, go, user, authLoading, setRedirectAfterAuth } = useApp()
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

  // Handle protected routes
  const isProtected = parts[0] === 'app' || parts[0] === 'new'

  useEffect(() => {
    if (!authLoading && isProtected && !user) {
      setRedirectAfterAuth(path)
      go('/signin')
    }
  }, [authLoading, isProtected, user, path, setRedirectAfterAuth, go])

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-solid text-muted">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-cyan" />
          <p className="text-sm">Connecting to Microbiome Atlas...</p>
        </div>
      </div>
    )
  }

  let view
  if (parts.length === 0) view = <Landing />
  else if (parts[0] === 'signin') view = <Auth mode="signin" />
  else if (parts[0] === 'signup') view = <Auth mode="signup" />
  else if (parts[0] === 'forgot') view = <Auth mode="forgot" />
  else if (parts[0] === 'new') {
    if (!user) {
      view = null
    } else {
      view = <Wizard step={parts[1] ?? 'upload'} />
    }
  } else if (parts[0] === 'app') {
    if (!user) {
      view = null
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
    go('/')
    view = null
  }

  return (
    <>
      {view}
      <TooltipLayer />
      <Toast />
    </>
  )
}
