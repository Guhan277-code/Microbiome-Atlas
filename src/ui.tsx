import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Hexagon, Moon, Search, Sun, X } from 'lucide-react'
import { useApp } from './store'

/* ---------- tooltip layer ---------- */
type TipState = { x: number; y: number; content: ReactNode } | null
let tipSet: ((t: TipState) => void) | null = null
export const tip = {
  show: (e: { clientX: number; clientY: number }, content: ReactNode) => tipSet?.({ x: e.clientX, y: e.clientY, content }),
  hide: () => tipSet?.(null),
}
export function TooltipLayer() {
  const [t, set] = useState<TipState>(null)
  useEffect(() => {
    tipSet = set
    return () => {
      tipSet = null
    }
  }, [])
  if (!t) return null
  const left = Math.min(t.x + 14, window.innerWidth - 230)
  return (
    <div className="pointer-events-none fixed z-[100] max-w-[220px] rounded-xl border border-line bg-solid px-3 py-2 text-xs shadow-2xl fade" style={{ left, top: t.y + 14 }}>
      {t.content}
    </div>
  )
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight">
      <span className="grid place-items-center rounded-xl bg-gradient-to-br from-brand via-cyan to-violet text-[#04101f] shadow-[0_6px_18px_-4px_rgba(0,212,255,.6)]" style={{ width: size + 8, height: size + 8 }}>
        <Hexagon size={size - 6} strokeWidth={2.4} />
      </span>
      <span>Microbiome Atlas</span>
    </span>
  )
}

export function ThemeSwitch() {
  const { theme, setTheme } = useApp()
  return (
    <button className="theme-switch" role="switch" aria-checked={theme === 'dark'} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      <i className="thumb" />
      <span className="sun"><Sun size={16} /></span>
      <span className="moon"><Moon size={16} /></span>
    </button>
  )
}

export function Btn({ variant = 'ghost', size, className = '', children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'icon' }) {
  return (
    <button {...p} className={`btn glow ${variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : ''} ${size === 'sm' ? 'btn-sm' : size === 'icon' ? 'btn-icon' : ''} ${className}`}>
      {children}
    </button>
  )
}

export function Card({ children, className = '', lift = true, style, onClick }: { children: ReactNode; className?: string; lift?: boolean; style?: CSSProperties; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={style} className={`card glow ${lift ? 'lift' : ''} ${className}`}>
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}

const TONE: Record<string, string> = {
  ok: 'text-ok border-ok/40 bg-ok/10',
  warn: 'text-[#d99a00] border-warn/50 bg-warn/10',
  bad: 'text-bad border-bad/40 bg-bad/10',
  info: 'text-brand border-brand/40 bg-brand/10',
  violet: 'text-violet border-violet/40 bg-violet/10',
  mute: 'text-muted',
}
export const Badge = ({ tone = 'mute', children }: { tone?: keyof typeof TONE; children: ReactNode }) => <span className={`chip ${TONE[tone]}`}>{children}</span>

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4 fade" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`card pop relative max-h-[88vh] w-full overflow-auto bg-solid p-6 ${wide ? 'max-w-4xl' : 'max-w-md'}`} style={{ background: 'var(--solid)' }}>
        <div className="relative z-[1]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold">{title}</h3>
            <button className="btn btn-icon btn-sm" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ title, desc, actions, badge }: { title: string; desc?: string; actions?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
          {badge}
        </div>
        {desc && <p className="sci mt-1.5 max-w-3xl text-sm text-muted">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <Card lift={false} className="p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand/15 text-brand">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="sci mx-auto mt-1 max-w-md text-sm text-muted">{text}</p>
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </Card>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block min-w-0">
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="sci mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  )
}

export function Select({ label, value, onChange, options, className = '' }: { label?: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string; disabled?: boolean })[]; className?: string }) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const el = (
    <select className={`input ${className}`} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {opts.map((o) => (
        <option key={o.value} value={o.value} disabled={(o as { disabled?: boolean }).disabled}>{o.label}</option>
      ))}
    </select>
  )
  return label ? <Field label={label}>{el}</Field> : el
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const i = options.findIndex((o) => o.value === value)
  return (
    <div className="relative inline-grid rounded-full border border-line bg-solid p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }} role="tablist">
      <i className="absolute top-1 bottom-1 rounded-full bg-gradient-to-r from-brand to-cyan shadow-lg transition-all duration-300" style={{ width: `calc((100% - 8px) / ${options.length})`, left: `calc(4px + ${i} * (100% - 8px) / ${options.length})` }} />
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)} className={`relative z-[1] rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${o.value === value ? 'text-[#04101f]' : 'text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string }[] }) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={`glow relative shrink-0 overflow-hidden rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all ${value === t.id ? 'border-brand/60 bg-brand/15 text-ink shadow-[0_6px_20px_-8px_rgba(66,133,244,.8)]' : 'border-transparent text-muted hover:text-ink'}`}>
          <span className="relative z-[1]">{t.label}</span>
        </button>
      ))}
    </div>
  )
}

export function ChipSelect({ options, value, onChange, max }: { options: string[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <div className="flex max-h-28 flex-wrap gap-1.5 overflow-auto">
      {options.map((o) => {
        const on = value.includes(o)
        return (
          <button key={o} onClick={() => onChange(on ? value.filter((x) => x !== o) : max && value.length >= max ? [...value.slice(1), o] : [...value, o])} className={`mono rounded-lg border px-2.5 py-1 text-xs transition ${on ? 'border-cyan/60 bg-cyan/15 text-ink' : 'border-line text-muted hover:border-brand/50'}`} aria-pressed={on}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full border border-line transition-colors ${checked ? 'bg-gradient-to-r from-brand to-cyan' : 'bg-solid'}`}>
      <i className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setOn(true), io.disconnect()), { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${on ? 'in' : ''} ${className}`} style={{ transitionDelay: delay + 'ms' }}>
      {children}
    </div>
  )
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h }} />
}

export function Stat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="p-5">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand/25 to-violet/25 text-cyan">{icon}</div>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mono mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-faint">{sub}</div>}
    </Card>
  )
}

/* ---------- data table ---------- */
export interface Col<T> {
  key: string
  label: string
  render?: (r: T) => ReactNode
  value?: (r: T) => string | number
  align?: 'right'
  mono?: boolean
}
export function DataTable<T>({ cols, rows, pageSize = 10, search = true, extra, empty = 'No rows match the current filters.', initialSort, onRow, rowKey, dense }: { cols: Col<T>[]; rows: T[]; pageSize?: number; search?: boolean; extra?: ReactNode; empty?: string; initialSort?: { key: string; dir: 1 | -1 }; onRow?: (r: T) => void; rowKey?: (r: T, i: number) => string; dense?: boolean }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(initialSort ?? null)
  const [page, setPage] = useState(0)
  const val = (c: Col<T>, r: T) => (c.value ? c.value(r) : ((r as Record<string, unknown>)[c.key] as string | number) ?? '')
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    let out = t ? rows.filter((r) => cols.some((c) => String(val(c, r)).toLowerCase().includes(t))) : rows
    if (sort) {
      const c = cols.find((x) => x.key === sort.key)
      if (c) out = [...out].sort((a, b) => {
        const x = val(c, a)
        const y = val(c, b)
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort])
  useEffect(() => setPage(0), [q, rows])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const cur = Math.min(page, pages - 1)
  const slice = filtered.slice(cur * pageSize, cur * pageSize + pageSize)
  return (
    <div>
      {(search || extra) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {search && (
            <div className="relative min-w-[180px] flex-1">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
              <input className="input pl-9" placeholder="Search table…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search table" />
            </div>
          )}
          {extra}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="tbl w-full min-w-[560px]">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} className={c.align === 'right' ? '!text-right' : ''}>
                  <button className="inline-flex items-center gap-1 uppercase hover:text-ink" onClick={() => setSort(sort?.key === c.key ? { key: c.key, dir: (sort.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 })}>
                    {c.label}
                    {sort?.key === c.key && (sort.dir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={rowKey ? rowKey(r, i) : i} onClick={onRow ? () => onRow(r) : undefined} className={onRow ? 'cursor-pointer' : ''}>
                {cols.map((c) => (
                  <td key={c.key} className={`${c.align === 'right' ? 'text-right' : ''} ${c.mono ? 'mono text-[0.8rem]' : ''} ${dense ? '!py-1.5' : ''}`}>
                    {c.render ? c.render(r) : String(val(c, r))}
                  </td>
                ))}
              </tr>
            ))}
            {!slice.length && (
              <tr>
                <td colSpan={cols.length} className="py-8 text-center text-muted">{empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="mono">{filtered.length.toLocaleString()} row{filtered.length === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-icon btn-sm" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
          <span className="mono">{cur + 1} / {pages}</span>
          <button className="btn btn-icon btn-sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
        </div>
      </div>
    </div>
  )
}

export const download = (name: string, text: string | Blob, mime = 'text/csv') => {
  const url = URL.createObjectURL(text instanceof Blob ? text : new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const ago = (t: number) => {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000))
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`
}
export const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
