import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Activity, BarChart3, BookOpen, Bell, Check, ChevronDown, Database, FileText, FlaskConical, GitCompare, Layers, LayoutDashboard, LogOut, Menu, Network, PieChart, Plus, Search, Settings as Cog, Sparkles, Table2, Upload, X } from 'lucide-react'
import { useApp } from './store'
import { SAMPLES } from './lib/samples'
import { Badge, Logo, ThemeSwitch, ago } from './ui'

export const NAV: { id: string; label: string; icon: typeof Database }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'datasets', label: 'Datasets', icon: Database },
  { id: 'composition', label: 'Composition', icon: PieChart },
  { id: 'alpha', label: 'Alpha Diversity', icon: BarChart3 },
  { id: 'beta', label: 'Beta Diversity', icon: GitCompare },
  { id: 'taxonomy', label: 'Taxonomic Explorer', icon: Network },
  { id: 'comparison', label: 'Sample Comparison', icon: Layers },
  { id: 'advanced', label: 'Advanced Analytics', icon: Sparkles },
  { id: 'results', label: 'Results', icon: Table2 },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'docs', label: 'Documentation', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Cog },
]

function useOutside(close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [close])
  return ref
}

function DatasetSwitcher() {
  const { datasets, active, setActive, loadSample, setDraft, go, notify } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useOutside(() => setOpen(false))
  if (!active) return null
  const warns = active.checks.filter((c) => c.status === 'warn').length
  const unused = SAMPLES.filter((s) => !datasets.some((d) => d.type === 'Sample' && d.fileName === `${s.key}_demo.csv`))
  return (
    <div ref={ref} className="relative min-w-0">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" className="glow card flex max-w-full items-center gap-3 !rounded-2xl px-3 py-1.5 text-left">
        <span className="relative z-[1] min-w-0">
          <span className="block truncate text-sm font-bold leading-tight">{active.name}</span>
          <span className="mono block truncate text-[0.68rem] leading-tight text-muted">{active.id} · {active.M.samples.length} samples · {active.M.features.length} features</span>
        </span>
        <span className="relative z-[1] hidden sm:block"><Badge tone={warns ? 'warn' : 'ok'}>{warns ? `Valid · ${warns} warn` : 'Valid'}</Badge></span>
        <ChevronDown size={16} className={`relative z-[1] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pop fixed top-[68px] right-3 left-3 z-50 max-h-[75vh] overflow-auto rounded-2xl border border-line p-2 shadow-2xl sm:absolute sm:top-full sm:right-auto sm:left-0 sm:mt-2 sm:w-[380px]" style={{ background: 'var(--solid)' }} role="listbox">
          <div className="label px-3 py-2">Your datasets</div>
          {datasets.map((d) => (
            <button key={d.id} role="option" aria-selected={d.id === active.id} onClick={() => { setActive(d.id); setOpen(false); notify('info', `Switched to ${d.name}.`) }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--row)] ${d.id === active.id ? 'bg-brand/10' : ''}`}>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{d.name}</span><span className="mono block text-[0.7rem] text-muted">{d.id} · {d.M.samples.length} samples · {d.M.features.length} features</span></span>
              <Badge tone={d.checks.some((c) => c.status === 'warn') ? 'warn' : 'ok'}>{d.checks.some((c) => c.status === 'warn') ? 'Warnings' : 'Valid'}</Badge>
              {d.id === active.id && <Check size={15} className="text-cyan" />}
            </button>
          ))}
          {unused.length > 0 && <div className="label px-3 pt-3 pb-1">Sample datasets (demo)</div>}
          {unused.map((s) => (
            <button key={s.key} onClick={() => { loadSample(s.key); setOpen(false); go('/new/configure') }} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--row)]">
              <span>{s.name}</span><span className="text-xs text-brand">Load</span>
            </button>
          ))}
          <div className="mt-2 grid gap-2 border-t border-line p-2 sm:grid-cols-2">
            <button className="btn btn-sm" onClick={() => { setOpen(false); setDraft(null); go('/new/upload') }}><Upload size={14} /> Upload New Dataset</button>
            <button className="btn btn-sm btn-primary" onClick={() => { setOpen(false); setDraft(null); go('/new/upload') }}><Plus size={14} /> Create New Analysis</button>
          </div>
        </div>
      )}
    </div>
  )
}

function GlobalSearch() {
  const { datasets, active, setActive, go, setOrganism } = useApp()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useOutside(() => setOpen(false))
  const res = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    const out: { label: string; sub: string; run: () => void }[] = []
    NAV.filter((n) => n.label.toLowerCase().includes(t)).forEach((n) => out.push({ label: n.label, sub: 'Page', run: () => go('/app/' + n.id) }))
    datasets.filter((d) => (d.name + d.id).toLowerCase().includes(t)).forEach((d) => out.push({ label: d.name, sub: 'Dataset · ' + d.id, run: () => { setActive(d.id); go('/app/overview') } }))
    if (active) {
      const seen = new Set<string>()
      active.M.meta.forEach((m) => { if (m.organism.toLowerCase().includes(t) && !seen.has(m.organism) && seen.size < 6) { seen.add(m.organism); out.push({ label: m.organism, sub: 'Organism in active dataset', run: () => { setOrganism(m.organism); go('/app/taxonomy') } }) } })
    }
    return out.slice(0, 10)
  }, [q, datasets, active, go, setActive, setOrganism])
  return (
    <div ref={ref} className="relative hidden min-w-0 max-w-sm flex-1 md:block">
      <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
      <input className="input !rounded-full pl-9" placeholder="Search datasets, pages, organisms…" value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true) }} aria-label="Search" />
      {open && q && (
        <div className="pop absolute top-full mt-2 w-full overflow-hidden rounded-2xl border border-line p-1 shadow-2xl" style={{ background: 'var(--solid)' }}>
          {res.length ? res.map((r, i) => <button key={i} className="block w-full rounded-xl px-3 py-2 text-left hover:bg-[var(--row)]" onClick={() => { r.run(); setOpen(false); setQ('') }}><div className="text-sm font-semibold">{r.label}</div><div className="text-xs text-muted">{r.sub}</div></button>) : <p className="p-3 text-sm text-muted">No results.</p>}
        </div>
      )}
    </div>
  )
}

function Bells() {
  const { notes, markRead, go } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useOutside(() => setOpen(false))
  const unread = notes.filter((n) => !n.read).length
  return (
    <div ref={ref} className="relative">
      <button className="btn btn-icon relative" aria-label="Notifications" onClick={() => { setOpen(!open); if (!open) setTimeout(markRead, 1500) }}>
        <Bell size={17} />
        {unread > 0 && <i className="mono absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold not-italic text-white">{unread}</i>}
      </button>
      {open && (
        <div className="pop fixed top-[68px] right-3 left-3 z-50 rounded-2xl border border-line p-2 shadow-2xl sm:absolute sm:top-full sm:left-auto sm:mt-2 sm:w-80" style={{ background: 'var(--solid)' }}>
          <div className="label px-3 py-2">Notifications</div>
          <div className="max-h-72 overflow-auto">
            {notes.slice(0, 8).map((n) => <div key={n.id} className="rounded-xl px-3 py-2 text-sm hover:bg-[var(--row)]"><div>{n.text}</div><div className="text-xs text-faint">{n.kind} · {ago(n.t)}</div></div>)}
            {!notes.length && <p className="p-3 text-sm text-muted">Nothing yet. Uploads, validations, analyses and reports will appear here.</p>}
          </div>
          <button className="btn btn-sm mt-2 w-full" onClick={() => { setOpen(false); go('/app/activity') }}>View all activity</button>
        </div>
      )}
    </div>
  )
}

function Profile() {
  const { user, settings, go, signOut } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useOutside(() => setOpen(false))
  const name = user?.guest ? 'Guest Researcher' : user?.name ?? settings.name
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="btn btn-icon !rounded-full bg-gradient-to-br from-brand to-violet text-sm text-white" aria-label="User menu">{name.slice(0, 2).toUpperCase()}</button>
      {open && (
        <div className="pop absolute top-full right-0 z-50 mt-2 w-56 rounded-2xl border border-line p-2 shadow-2xl" style={{ background: 'var(--solid)' }}>
          <div className="px-3 py-2"><div className="text-sm font-bold">{name}</div><div className="text-xs text-muted truncate">{user?.guest ? 'Guest (Local session)' : user?.email || 'Authenticated account'}</div></div>
          <button className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--row)]" onClick={() => { setOpen(false); go('/app/settings') }}>Settings</button>
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--row)]" onClick={signOut}><LogOut size={14} /> Sign out</button>
        </div>
      )}
    </div>
  )
}

export default function Shell({ page, children }: { page: string; children: ReactNode }) {
  const { go, active } = useApp()
  const [drawer, setDrawer] = useState(false)
  const [mini, setMini] = useState(false)
  useEffect(() => {
    if (!active) go('/new/upload')
  }, [active, go])
  useEffect(() => setDrawer(false), [page])
  if (!active) return null
  const side = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3" aria-label="Workspace">
      <div className="mb-4 flex items-center justify-between px-1 pt-1">
        <button onClick={() => go('/')}>{mini ? <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-cyan text-[#04101f]"><Network size={18} /></span> : <Logo size={24} />}</button>
        <button className="btn btn-icon btn-sm lg:hidden" onClick={() => setDrawer(false)} aria-label="Close menu"><X size={15} /></button>
      </div>
      {NAV.map((n) => {
        const on = page === n.id
        return (
          <button key={n.id} onClick={() => go('/app/' + n.id)} aria-current={on ? 'page' : undefined} title={n.label} className={`glow relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all ${on ? 'bg-gradient-to-r from-brand/30 to-cyan/10 text-ink shadow-[inset_0_0_0_1px_rgba(0,212,255,.35),0_8px_22px_-10px_rgba(66,133,244,.8)]' : 'text-muted hover:translate-x-0.5 hover:text-ink'}`}>
            <n.icon size={18} className={`relative z-[1] shrink-0 ${on ? 'text-cyan' : ''}`} />
            {!mini && <span className="relative z-[1] truncate">{n.label}</span>}
          </button>
        )
      })}
      <div className="mt-auto flex items-center justify-between gap-2 px-1 pt-4">
        {!mini && <span className="text-xs text-muted">Theme</span>}
        <ThemeSwitch />
      </div>
    </nav>
  )
  return (
    <div className="min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-surface backdrop-blur-xl transition-[width] duration-300 lg:block ${mini ? 'w-[76px]' : 'w-[250px]'}`}>{side}</aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden fade">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[270px] border-r border-line" style={{ background: 'var(--solid)', animation: 'fadeIn .25s' }}>{side}</aside>
        </div>
      )}
      <div className={`transition-[padding] duration-300 ${mini ? 'lg:pl-[76px]' : 'lg:pl-[250px]'}`}>
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface px-3 py-2.5 backdrop-blur-xl sm:gap-3 sm:px-6">
          <button className="btn btn-icon lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu size={18} /></button>
          <button className="btn btn-icon hidden lg:inline-flex" onClick={() => setMini(!mini)} aria-label="Collapse sidebar"><Menu size={18} /></button>
          <DatasetSwitcher />
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2"><Bells /><span className="hidden sm:block"><ThemeSwitch /></span><Profile /></div>
        </header>
        <main key={page + active.id} className="page-in mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
      </div>
      <span hidden><FlaskConical /></span>
    </div>
  )
}
