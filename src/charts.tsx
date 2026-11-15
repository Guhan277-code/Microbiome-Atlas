import { useState, type ReactNode } from 'react'
import { useApp } from './store'
import { tip } from './ui'
import { quantile } from './lib/science'

export const PALETTE = ['#4285F4', '#00D4FF', '#8B5CF6', '#34A853', '#FBBC05', '#EA4335', '#F472B6', '#14B8A6', '#F97316', '#A3E635', '#818CF8', '#38BDF8']
export const OTHER = '#64748B'
export const groupColor = (groups: string[], g: string) => PALETTE[Math.max(0, groups.indexOf(g)) % PALETTE.length]

function useC() {
  const { theme } = useApp()
  return theme === 'dark' ? { text: '#aab3c2', grid: 'rgba(255,255,255,0.08)', strong: '#f2f5fa', bg: '#141a26', stroke: '#141a26' } : { text: '#566176', grid: 'rgba(16,27,48,0.1)', strong: '#101b30', bg: '#ffffff', stroke: '#ffffff' }
}
const lin = (d0: number, d1: number, r0: number, r1: number) => (v: number) => d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
export function ticks(min: number, max: number, n = 5) {
  if (max <= min) max = min + 1
  const raw = (max - min) / n
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw)!
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(+v.toFixed(10))
  return out
}
const short = (s: string, n = 12) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const nf = (v: number) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(0) + 'k' : Math.abs(v) < 1 && v !== 0 ? v.toFixed(2) : String(+v.toFixed(2)))

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.label}</span>
      ))}
    </div>
  )
}

function Frame({ W, H, title, children }: { W: number; H: number; title: string; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title} data-chart={title} fontFamily="Inter, sans-serif" style={{ maxHeight: 460 }}>
      {children}
    </svg>
  )
}
function Axes({ W, H, l, r, t, b, yt, ys, xLabel, yLabel, fmt = nf }: { W: number; H: number; l: number; r: number; t: number; b: number; yt: number[]; ys: (v: number) => number; xLabel?: string; yLabel?: string; fmt?: (v: number) => string }) {
  const c = useC()
  return (
    <g fontSize="11" fill={c.text}>
      {yt.map((v) => (
        <g key={v}>
          <line x1={l} x2={W - r} y1={ys(v)} y2={ys(v)} stroke={c.grid} />
          <text x={l - 8} y={ys(v) + 4} textAnchor="end">{fmt(v)}</text>
        </g>
      ))}
      <line x1={l} x2={W - r} y1={H - b} y2={H - b} stroke={c.text} opacity=".5" />
      {yLabel && <text transform={`translate(14 ${(t + H - b) / 2}) rotate(-90)`} textAnchor="middle" fontWeight="600">{yLabel}</text>}
      {xLabel && <text x={(l + W - r) / 2} y={H - 6} textAnchor="middle" fontWeight="600">{xLabel}</text>}
    </g>
  )
}

/* ---------- donut ---------- */
export function Donut({ title, data, unit = '', center, fmtV }: { title: string; data: { label: string; value: number; color: string }[]; unit?: string; center?: string; fmtV?: (v: number) => string }) {
  const c = useC()
  const [hi, setHi] = useState<string | null>(null)
  const total = data.reduce((a, d) => a + d.value, 0)
  const R = 90
  const r = 56
  let a0 = -Math.PI / 2
  const f = fmtV ?? ((v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 }) + unit)
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 220 220" className="w-48 shrink-0" role="img" aria-label={title} data-chart={title} fontFamily="Inter, sans-serif">
        {data.map((d, i) => {
          const ang = total ? (d.value / total) * Math.PI * 2 : 0
          const a1 = a0 + Math.min(ang, Math.PI * 2 - 1e-4)
          const big = ang > Math.PI ? 1 : 0
          const o = hi === d.label ? 6 : 0
          const p = (rad: number, a: number) => `${110 + rad * Math.cos(a)} ${110 + rad * Math.sin(a)}`
          const path = `M ${p(R + o, a0)} A ${R + o} ${R + o} 0 ${big} 1 ${p(R + o, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${big} 0 ${p(r, a0)} Z`
          a0 += ang
          return (
            <path key={d.label} d={path} fill={d.color} stroke={c.stroke} strokeWidth="2" className="dot-in" style={{ animationDelay: i * 50 + 'ms', transition: 'd .2s', cursor: 'pointer' }} opacity={hi && hi !== d.label ? 0.45 : 1} onMouseMove={(e) => { setHi(d.label); tip.show(e, <div><b>{d.label}</b><div className="mono">{f(d.value)} ({((d.value / total) * 100).toFixed(1)}%)</div></div>) }} onMouseLeave={() => { setHi(null); tip.hide() }} onClick={() => setHi(hi === d.label ? null : d.label)} />
          )
        })}
        <text x="110" y="106" textAnchor="middle" fontSize="18" fontWeight="700" fill={c.strong}>{center ?? ''}</text>
        <text x="110" y="124" textAnchor="middle" fontSize="10" fill={c.text}>{center ? 'total' : ''}</text>
      </svg>
      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-[var(--row)]" onMouseEnter={() => setHi(d.label)} onMouseLeave={() => setHi(null)}>
            <i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate">{d.label}</span>
            <span className="mono text-muted">{total ? ((d.value / total) * 100).toFixed(1) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- stacked bars ---------- */
export function StackedBars({ title, labels, series, xLabel, yLabel, percent }: { title: string; labels: string[]; series: { name: string; color: string; values: number[] }[]; xLabel: string; yLabel: string; percent?: boolean }) {
  const c = useC()
  const W = 720
  const H = 380
  const l = 60
  const r = 12
  const t = 12
  const b = 92
  const totals = labels.map((_, i) => series.reduce((a, s) => a + s.values[i], 0))
  const max = percent ? 100 : Math.max(...totals, 1)
  const yt = ticks(0, max)
  const ys = lin(0, yt[yt.length - 1], H - b, t)
  const bw = (W - l - r) / labels.length
  return (
    <div>
      <Frame W={W} H={H} title={title}>
        <Axes {...{ W, H, l, r, t, b, yt, ys, xLabel, yLabel }} fmt={(v) => (percent ? v + '%' : nf(v))} />
        {labels.map((lb, i) => {
          let acc = 0
          return (
            <g key={lb}>
              {series.map((s) => {
                const raw = s.values[i]
                const v = percent ? (totals[i] ? (raw / totals[i]) * 100 : 0) : raw
                const y0 = ys(acc + v)
                const h = ys(acc) - y0
                acc += v
                return <rect key={s.name} className="bar-y" x={l + i * bw + bw * 0.14} width={bw * 0.72} y={y0} height={Math.max(0, h)} fill={s.color} rx="1.5" onMouseMove={(e) => tip.show(e, <div><b>{lb}</b><div style={{ color: s.color }}>{s.name}</div><div className="mono">{percent ? v.toFixed(2) + '%' : nf(raw)}</div></div>)} onMouseLeave={tip.hide} />
              })}
              <text transform={`translate(${l + i * bw + bw / 2} ${H - b + 12}) rotate(-45)`} textAnchor="end" fontSize="10" fill={c.text}>{short(lb, 16)}</text>
            </g>
          )
        })}
      </Frame>
      <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
    </div>
  )
}

/* ---------- bars ---------- */
export function Bars({ title, items, xLabel, yLabel, horizontal, fmtV, errs }: { title: string; items: { label: string; value: number; color?: string }[]; xLabel: string; yLabel: string; horizontal?: boolean; fmtV?: (v: number) => string; errs?: boolean }) {
  const c = useC()
  const f = fmtV ?? nf
  void errs
  const max = Math.max(...items.map((i) => i.value), 0)
  if (horizontal) {
    const rowH = 26
    const W = 720
    const l = 130
    const r = 60
    const t = 8
    const b = 44
    const H = t + b + items.length * rowH
    const xt = ticks(0, max)
    const xs = lin(0, xt[xt.length - 1], l, W - r)
    return (
      <Frame W={W} H={H} title={title}>
        <g fontSize="11" fill={c.text}>
          {xt.map((v) => (
            <g key={v}>
              <line y1={t} y2={H - b} x1={xs(v)} x2={xs(v)} stroke={c.grid} />
              <text x={xs(v)} y={H - b + 15} textAnchor="middle">{f(v)}</text>
            </g>
          ))}
          <text x={(l + W - r) / 2} y={H - 6} textAnchor="middle" fontWeight="600">{xLabel}</text>
          <text transform={`translate(12 ${(t + H - b) / 2}) rotate(-90)`} textAnchor="middle" fontWeight="600">{yLabel}</text>
          {items.map((it, i) => (
            <g key={it.label} onMouseMove={(e) => tip.show(e, <div><b>{it.label}</b><div className="mono">{f(it.value)}</div></div>)} onMouseLeave={tip.hide}>
              <text x={l - 8} y={t + i * rowH + rowH / 2 + 4} textAnchor="end">{short(it.label, 18)}</text>
              <rect className="bar-x" x={l} y={t + i * rowH + 4} width={Math.max(1, xs(it.value) - l)} height={rowH - 8} rx="4" fill={it.color ?? PALETTE[0]} style={{ animationDelay: i * 30 + 'ms' }} />
              <text x={xs(it.value) + 6} y={t + i * rowH + rowH / 2 + 4} fill={c.strong} fontSize="10">{f(it.value)}</text>
            </g>
          ))}
        </g>
      </Frame>
    )
  }
  const W = 720
  const H = 340
  const l = 60
  const r = 12
  const t = 12
  const b = 80
  const yt = ticks(0, max)
  const ys = lin(0, yt[yt.length - 1], H - b, t)
  const bw = (W - l - r) / Math.max(1, items.length)
  return (
    <Frame W={W} H={H} title={title}>
      <Axes {...{ W, H, l, r, t, b, yt, ys, xLabel, yLabel }} fmt={f} />
      {items.map((it, i) => (
        <g key={it.label} onMouseMove={(e) => tip.show(e, <div><b>{it.label}</b><div className="mono">{f(it.value)}</div></div>)} onMouseLeave={tip.hide}>
          <rect className="bar-y" x={l + i * bw + bw * 0.15} width={bw * 0.7} y={ys(it.value)} height={Math.max(0, ys(0) - ys(it.value))} rx="4" fill={it.color ?? PALETTE[0]} style={{ animationDelay: i * 25 + 'ms' }} />
          <text transform={`translate(${l + i * bw + bw / 2} ${H - b + 12}) rotate(-45)`} textAnchor="end" fontSize="10" fill={c.text}>{short(it.label, 16)}</text>
        </g>
      ))}
    </Frame>
  )
}

/* ---------- heatmap ---------- */
export function Heatmap({ title, rows, cols, values, xLabel, yLabel, legend, fmtV, domain, minCell = 22 }: { title: string; rows: string[]; cols: string[]; values: number[][]; xLabel: string; yLabel: string; legend: string; fmtV?: (v: number) => string; domain?: [number, number]; minCell?: number }) {
  const c = useC()
  const f = fmtV ?? ((v: number) => v.toFixed(3))
  if (!rows.length || !cols.length || !values.length) {
    return <div className="py-8 text-center text-sm text-muted">No heatmap data available.</div>
  }
  let minVal = Infinity
  let maxVal = -Infinity
  for (const row of values) {
    for (const v of row) {
      if (Number.isFinite(v)) {
        if (v < minVal) minVal = v
        if (v > maxVal) maxVal = v
      }
    }
  }
  if (!Number.isFinite(minVal)) minVal = 0
  if (!Number.isFinite(maxVal)) maxVal = 1
  const lo = domain?.[0] ?? minVal
  const hi = domain?.[1] ?? maxVal
  const l = 120
  const t = 12
  const b = 100
  const cw = Math.max(minCell, Math.min(44, 640 / Math.max(cols.length, 1)))
  const ch = Math.max(18, Math.min(34, cw))
  const W = l + cols.length * cw + 20
  const H = t + rows.length * ch + b
  const col = (v: number) => {
    const k = hi === lo ? 0 : (v - lo) / (hi - lo)
    const a = [18, 30, 80]
    const m = [66, 133, 244]
    const z = [0, 212, 255]
    const y = [251, 188, 5]
    const p = k < 0.5 ? [a, m] : [m, z]
    const kk = k < 0.5 ? k * 2 : (k - 0.5) * 2
    void y
    return `rgb(${p[0].map((x, i) => Math.round(x + (p[1][i] - x) * kk)).join(',')})`
  }
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: Math.min(W, 560) }}>
        <Frame W={W} H={H} title={title}>
          <g fontSize="10" fill={c.text}>
            {rows.map((rw, i) => (
              <g key={rw}>
                <text x={l - 6} y={t + i * ch + ch / 2 + 3} textAnchor="end">{short(rw, 16)}</text>
                {cols.map((cn, j) => (
                  <rect key={cn} x={l + j * cw} y={t + i * ch} width={cw - 1} height={ch - 1} rx="2" fill={col(values[i][j])} className="dot-in" style={{ animationDelay: (i + j) * 8 + 'ms' }} onMouseMove={(e) => tip.show(e, <div><b>{rw}</b> × <b>{cn}</b><div className="mono">{f(values[i][j])}</div></div>)} onMouseLeave={tip.hide} />
                ))}
              </g>
            ))}
            {cols.map((cn, j) => (
              <text key={cn} transform={`translate(${l + j * cw + cw / 2} ${t + rows.length * ch + 10}) rotate(-50)`} textAnchor="end">{short(cn, 14)}</text>
            ))}
            <text x={l + (cols.length * cw) / 2} y={H - 4} textAnchor="middle" fontWeight="600">{xLabel}</text>
            <text transform={`translate(10 ${t + (rows.length * ch) / 2}) rotate(-90)`} textAnchor="middle" fontWeight="600">{yLabel}</text>
          </g>
        </Frame>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
        <span>{legend}:</span>
        <span className="mono">{f(lo)}</span>
        <i className="h-2.5 w-32 rounded-full" style={{ background: 'linear-gradient(90deg, rgb(18,30,80), rgb(66,133,244), rgb(0,212,255))' }} />
        <span className="mono">{f(hi)}</span>
      </div>
    </div>
  )
}

/* ---------- box & violin ---------- */
type G = { name: string; color: string; values: number[]; labels?: string[] }
function gAxes(groups: G[], yLabel: string, fmtV?: (v: number) => string, pad = true) {
  const all = groups.flatMap((g) => g.values).filter(Number.isFinite)
  if (!all.length) return null
  let lo = Math.min(...all)
  let hi = Math.max(...all)
  if (pad) {
    const d = (hi - lo || Math.abs(hi) || 1) * 0.12
    lo -= d
    hi += d
    if (lo < 0 && Math.min(...all) >= 0) lo = 0
  }
  const W = 720
  const H = 340
  const l = 60
  const r = 12
  const t = 12
  const b = 56
  const yt = ticks(lo, hi)
  const ys = lin(yt[0], yt[yt.length - 1], H - b, t)
  const bw = (W - l - r) / Math.max(1, groups.length)
  return { W, H, l, r, t, b, yt, ys, bw, lo, hi, yLabel, fmtV }
}
export function BoxPlot({ title, groups, yLabel, xLabel = 'Sample group' }: { title: string; groups: G[]; yLabel: string; xLabel?: string }) {
  const c = useC()
  const A = gAxes(groups, yLabel)
  if (!A) return <div className="py-8 text-center text-sm text-muted">No finite values available for this metric.</div>
  const { W, H, l, r, t, b, yt, ys, bw } = A
  return (
    <div>
      <Frame W={W} H={H} title={title}>
        <Axes {...{ W, H, l, r, t, b, yt, ys, xLabel, yLabel }} />
        {groups.map((g, i) => {
          const cx = l + i * bw + bw / 2
          if (!g.values.length) {
            return <text key={g.name} x={cx} y={H - b + 18} textAnchor="middle" fontSize="11" fill={c.text}>{short(g.name, 18)}</text>
          }
          const q = [0, 0.25, 0.5, 0.75, 1].map((p) => quantile(g.values, p))
          const w = Math.min(70, bw * 0.4)
          return (
            <g key={g.name} onMouseMove={(e) => tip.show(e, <div><b>{g.name}</b> (n={g.values.length})<div className="mono">min {nf(q[0])} · Q1 {nf(q[1])}<br />median {nf(q[2])}<br />Q3 {nf(q[3])} · max {nf(q[4])}</div></div>)} onMouseLeave={tip.hide}>
              <line x1={cx} x2={cx} y1={ys(q[0])} y2={ys(q[4])} stroke={g.color} strokeWidth="2" />
              <rect className="bar-y" x={cx - w / 2} y={ys(q[3])} width={w} height={Math.max(1, ys(q[1]) - ys(q[3]))} fill={g.color} fillOpacity=".3" stroke={g.color} strokeWidth="2" rx="4" />
              <line x1={cx - w / 2} x2={cx + w / 2} y1={ys(q[2])} y2={ys(q[2])} stroke={c.strong} strokeWidth="2.5" />
              {g.values.map((v, k) => <circle key={k} cx={cx + ((k * 37) % 21 - 10) * (w / 60)} cy={ys(v)} r="3.5" fill={g.color} stroke={c.stroke} className="dot-in" />)}
              <text x={cx} y={H - b + 18} textAnchor="middle" fontSize="11" fill={c.text}>{short(g.name, 18)}</text>
            </g>
          )
        })}
      </Frame>
      <Legend items={groups.map((g) => ({ label: `${g.name} (n=${g.values.length})`, color: g.color }))} />
    </div>
  )
}
export function Violin({ title, groups, yLabel, xLabel = 'Sample group' }: { title: string; groups: G[]; yLabel: string; xLabel?: string }) {
  const c = useC()
  const A = gAxes(groups, yLabel)
  if (!A) return <div className="py-8 text-center text-sm text-muted">No finite values available for this metric.</div>
  const { W, H, l, r, t, b, yt, ys, bw } = A
  return (
    <div>
      <Frame W={W} H={H} title={title}>
        <Axes {...{ W, H, l, r, t, b, yt, ys, xLabel, yLabel }} />
        {groups.map((g, i) => {
          const cx = l + i * bw + bw / 2
          const n = g.values.length
          if (!n) {
            return <text key={g.name} x={cx} y={H - b + 18} textAnchor="middle" fontSize="11" fill={c.text}>{short(g.name, 18)}</text>
          }
          const sd = Math.sqrt(g.values.reduce((a, v) => a + (v - g.values.reduce((x, y) => x + y, 0) / n) ** 2, 0) / Math.max(1, n - 1))
          const bwid = (1.06 * (sd || (A.hi - A.lo) / 10) * Math.pow(n, -0.2)) || 0.1
          const lo = A.yt[0]
          const hi = A.yt[A.yt.length - 1]
          const pts = Array.from({ length: 40 }, (_, k) => {
            const y = lo + ((hi - lo) * k) / 39
            return { y, d: g.values.reduce((a, v) => a + Math.exp(-0.5 * ((y - v) / bwid) ** 2), 0) / (n * bwid * Math.sqrt(2 * Math.PI)) }
          })
          const md = Math.max(...pts.map((p) => p.d), 1e-9)
          const hw = Math.min(70, bw * 0.42)
          const left = pts.map((p) => `${cx - (p.d / md) * hw},${ys(p.y)}`)
          const right = [...pts].reverse().map((p) => `${cx + (p.d / md) * hw},${ys(p.y)}`)
          const med = quantile(g.values, 0.5)
          return (
            <g key={g.name} onMouseMove={(e) => tip.show(e, <div><b>{g.name}</b> (n={n})<div className="mono">median {nf(med)}</div><div className="text-faint">Kernel density estimate</div></div>)} onMouseLeave={tip.hide}>
              <polygon points={[...left, ...right].join(' ')} fill={g.color} fillOpacity=".35" stroke={g.color} strokeWidth="2" className="dot-in" />
              <line x1={cx - 14} x2={cx + 14} y1={ys(med)} y2={ys(med)} stroke={c.strong} strokeWidth="2.5" />
              {g.values.map((v, k) => <circle key={k} cx={cx + ((k * 37) % 21 - 10) * 0.6} cy={ys(v)} r="3" fill={g.color} stroke={c.stroke} />)}
              <text x={cx} y={H - b + 18} textAnchor="middle" fontSize="11" fill={c.text}>{short(g.name, 18)}</text>
            </g>
          )
        })}
      </Frame>
      <Legend items={groups.map((g) => ({ label: `${g.name} (n=${g.values.length})`, color: g.color }))} />
    </div>
  )
}

/* ---------- scatter ---------- */
export function Scatter({ title, points, xLabel, yLabel, legend }: { title: string; points: { x: number; y: number; label: string; color: string; group: string }[]; xLabel: string; yLabel: string; legend: { label: string; color: string }[] }) {
  const c = useC()
  const W = 720
  const H = 420
  const l = 64
  const r = 16
  const t = 12
  const b = 50
  const xs0 = points.map((p) => p.x)
  const ys0 = points.map((p) => p.y)
  const pad = (a: number[]) => (Math.max(...a) - Math.min(...a) || 1) * 0.12
  const xt = ticks(Math.min(...xs0) - pad(xs0), Math.max(...xs0) + pad(xs0))
  const yt = ticks(Math.min(...ys0) - pad(ys0), Math.max(...ys0) + pad(ys0))
  const xs = lin(xt[0], xt[xt.length - 1], l, W - r)
  const ys = lin(yt[0], yt[yt.length - 1], H - b, t)
  return (
    <div>
      <Frame W={W} H={H} title={title}>
        <Axes {...{ W, H, l, r, t, b, yt, ys, yLabel }} fmt={(v) => (+v.toFixed(2)).toString()} />
        <g fontSize="11" fill={c.text}>
          {xt.map((v) => (
            <g key={v}>
              <line x1={xs(v)} x2={xs(v)} y1={t} y2={H - b} stroke={c.grid} />
              <text x={xs(v)} y={H - b + 15} textAnchor="middle">{+v.toFixed(2)}</text>
            </g>
          ))}
          <text x={(l + W - r) / 2} y={H - 6} textAnchor="middle" fontWeight="600">{xLabel}</text>
        </g>
        {points.map((p) => (
          <circle key={p.label} className="dot-in" cx={xs(p.x)} cy={ys(p.y)} r="7" fill={p.color} fillOpacity=".85" stroke={c.stroke} strokeWidth="2" style={{ cursor: 'pointer' }} onMouseMove={(e) => tip.show(e, <div><b className="mono">{p.label}</b><div>{p.group}</div><div className="mono">PC1 {p.x.toFixed(3)} · PC2 {p.y.toFixed(3)}</div></div>)} onMouseLeave={tip.hide} />
        ))}
      </Frame>
      <Legend items={legend} />
    </div>
  )
}

/* ---------- line ---------- */
export function LineChart({ title, labels, series, xLabel, yLabel }: { title: string; labels: string[]; series: { name: string; color: string; values: (number | null)[] }[]; xLabel: string; yLabel: string }) {
  const c = useC()
  const W = 720
  const H = 320
  const l = 60
  const r = 16
  const t = 12
  const b = 70
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null))
  const yt = ticks(Math.min(0, ...all), Math.max(...all, 1))
  const ys = lin(yt[0], yt[yt.length - 1], H - b, t)
  const xs = (i: number) => l + ((W - l - r) * (i + 0.5)) / labels.length
  return (
    <div>
      <Frame W={W} H={H} title={title}>
        <Axes {...{ W, H, l, r, t, b, yt, ys, xLabel, yLabel }} />
        {labels.map((lb, i) => <text key={lb} transform={`translate(${xs(i)} ${H - b + 12}) rotate(-45)`} textAnchor="end" fontSize="10" fill={c.text}>{short(lb, 14)}</text>)}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : [xs(i), ys(v), v, i] as const))
          let d = ''
          pts.forEach((p) => { if (p) d += (d ? 'L' : 'M') + p[0] + ' ' + p[1] })
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" pathLength="1" strokeDasharray="1" style={{ ['--len' as string]: 1, animation: 'dash 1.2s ease both' }} />
              {pts.map((p) => p && <circle key={p[3]} cx={p[0]} cy={p[1]} r="4.5" fill={s.color} stroke={c.stroke} strokeWidth="2" onMouseMove={(e) => tip.show(e, <div><b>{labels[p[3]]}</b><div style={{ color: s.color }}>{s.name}</div><div className="mono">{nf(p[2])}</div></div>)} onMouseLeave={tip.hide} />)}
            </g>
          )
        })}
      </Frame>
      <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
    </div>
  )
}
