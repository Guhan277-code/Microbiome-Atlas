import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Search } from 'lucide-react'
import { useApp } from '../store'
import { Bars, Donut, Legend, PALETTE, OTHER } from '../charts'
import { Badge, Btn, Card, DataTable, PageHeader, Segmented, Select } from '../ui'
import { ChartCard, Gate, Note, useData } from './common'
import { LEVELS, aggregate, bcPair, fmt, relMatrix, spearman } from '../lib/science'

/* ================= Taxonomic Explorer ================= */
interface Node {
  id: string
  name: string
  depth: number
  rank: string
  children: Node[]
  feats: number[]
}

export function Taxonomy() {
  return (
    <div>
      <PageHeader title="Taxonomic Explorer" desc="Browse the lineage tree, search organisms and inspect any taxon across samples and groups." />
      <Gate module="taxonomy"><TaxInner /></Gate>
    </div>
  )
}
function TaxInner() {
  const { organism, setOrganism } = useApp()
  const { M, d, colorOf } = useData()
  const [q, setQ] = useState('')
  const [rank, setRank] = useState('All')
  const [mode, setMode] = useState<'relative' | 'raw'>('relative')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [sel, setSel] = useState<string | null>(null)
  const hasLineage = M.meta.some((m) => m.lineage)
  const { root, byId } = useMemo(() => {
    const root: Node = { id: '', name: 'root', depth: -1, rank: '', children: [], feats: [] }
    const byId = new Map<string, Node>()
    M.meta.forEach((m, j) => {
      const path = m.lineage ? m.lineage.split(';').map((x) => x.trim()).filter(Boolean) : [m.organism]
      let cur = root
      path.forEach((p, depth) => {
        const id = path.slice(0, depth + 1).join('|')
        let n = byId.get(id)
        if (!n) {
          n = { id, name: p, depth, rank: m.lineage ? LEVELS[depth] ?? 'Other' : m.rank || 'taxon', children: [], feats: [] }
          byId.set(id, n)
          cur.children.push(n)
        }
        n.feats.push(j)
        cur = n
      })
    })
    return { root, byId }
  }, [M])
  const R = useMemo(() => relMatrix(M.X), [M])
  const per = (n: Node) => M.samples.map((_, i) => ({ raw: n.feats.reduce((a, j) => a + M.X[i][j], 0), rel: n.feats.reduce((a, j) => a + R[i][j], 0) * 100 }))
  useEffect(() => {
    if (!organism) return
    const n = [...byId.values()].find((x) => x.name === organism)
    if (n) {
      const parts = n.id.split('|')
      setOpen((o) => new Set([...o, ...parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('|'))]))
      setSel(n.id)
    }
    setOrganism(null)
  }, [organism, byId, setOrganism])
  const t = q.trim().toLowerCase()
  const maxDepth = rank === 'All' ? 99 : LEVELS.indexOf(rank as never)
  const matches = (n: Node): boolean => n.name.toLowerCase().includes(t) || n.children.some(matches)
  const meanRel = (n: Node) => per(n).reduce((a, x) => a + x.rel, 0) / M.samples.length
  const render = (n: Node): React.ReactNode => {
    if (t && !matches(n)) return null
    if (hasLineage && n.depth > maxDepth) return null
    const kids = n.children.filter((c) => (!t || matches(c)) && (!hasLineage || c.depth <= maxDepth))
    const isOpen = t ? true : open.has(n.id)
    const total = n.feats.reduce((a, j) => a + M.X.reduce((s, r) => s + r[j], 0), 0)
    return (
      <div key={n.id}>
        <div className={`flex items-center gap-1 rounded-lg py-1 pr-2 transition-colors hover:bg-[var(--row)] ${sel === n.id ? 'bg-brand/15' : ''}`} style={{ paddingLeft: n.depth * 18 + 4 }}>
          <button className="grid h-6 w-6 shrink-0 place-items-center text-muted" aria-label={isOpen ? 'Collapse' : 'Expand'} disabled={!kids.length} onClick={() => setOpen((o) => { const s = new Set(o); if (s.has(n.id)) s.delete(n.id); else s.add(n.id); return s })}>
            {kids.length ? isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : <i className="h-1.5 w-1.5 rounded-full bg-faint" />}
          </button>
          <button className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm" onClick={() => setSel(n.id)}>
            <span className="truncate font-medium">{n.name}</span>
            <span className="text-[0.65rem] text-faint">{n.rank}</span>
            <span className="mono ml-auto shrink-0 text-xs text-muted">{mode === 'relative' ? meanRel(n).toFixed(2) + '%' : total.toLocaleString()}</span>
          </button>
        </div>
        {isOpen && kids.map(render)}
      </div>
    )
  }
  const node = sel ? byId.get(sel) : null
  const nd = node ? per(node) : []
  const grp = d.groups.map((g) => { const ix = M.samples.map((_s, i) => i).filter((i) => M.groupOf[M.samples[i]] === g); return { g, v: ix.reduce((a, i) => a + (mode === 'relative' ? nd[i].rel : nd[i].raw), 0) / Math.max(1, ix.length) } })
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Card lift={false} className="p-5 lg:col-span-2">
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[160px] flex-1"><Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" /><input className="input pl-9" placeholder="Search organisms..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search organisms" /></div>
          {hasLineage && <Select value={rank} onChange={setRank} options={['All', ...LEVELS]} className="!w-32" />}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Btn size="sm" onClick={() => setOpen(new Set(byId.keys()))}><ChevronsUpDown size={13} /> Expand all</Btn>
          <Btn size="sm" onClick={() => setOpen(new Set())}><ChevronsDownUp size={13} /> Collapse all</Btn>
          <div className="ml-auto"><Segmented value={mode} onChange={setMode} options={[{ value: 'relative', label: 'Mean %' }, { value: 'raw', label: 'Raw' }]} /></div>
        </div>
        {!hasLineage && <div className="mb-3"><Note tone="warn">No lineage column was mapped, so only a flat list of organisms is available. Taxonomy is not inferred.</Note></div>}
        <div className="max-h-[560px] overflow-auto" role="tree">{root.children.map(render)}</div>
      </Card>
      <div className="space-y-5 lg:col-span-3">
        {!node ? (
          <Card lift={false} className="p-10 text-center text-muted">Select a taxon in the tree to inspect its abundance across samples and groups.</Card>
        ) : (
          <>
            <Card lift={false} className="p-5">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{node.name}</h2><Badge tone="info">{node.rank}</Badge></div>
              <p className="sci mt-1 text-xs text-muted">{node.id.split('|').join(' > ')}</p>
              <div className="mono mt-3 grid grid-cols-3 gap-3 text-sm"><div><div className="label">Features</div>{node.feats.length}</div><div><div className="label">Total reads</div>{nd.reduce((a, x) => a + x.raw, 0).toLocaleString()}</div><div><div className="label">Mean rel.</div>{fmt(nd.reduce((a, x) => a + x.rel, 0) / nd.length, 3)}%</div></div>
              {node.feats.length <= 6 && <p className="sci mt-3 text-xs text-muted">Organisms: {node.feats.map((j) => `${M.meta[j].organism} (${M.features[j]})`).join(', ')}</p>}
            </Card>
            <ChartCard title="Distribution across samples">
              <Bars title={`${node.name} per sample`} xLabel="Sample" yLabel={mode === 'relative' ? 'Relative abundance (%)' : 'Raw abundance (reads)'} items={M.samples.map((s, i) => ({ label: s, value: mode === 'relative' ? nd[i].rel : nd[i].raw, color: colorOf(M.groupOf[s]) }))} fmtV={mode === 'relative' ? (v) => v.toFixed(2) : undefined} />
              <Legend items={d.groups.map((g) => ({ label: g, color: colorOf(g) }))} />
            </ChartCard>
            <ChartCard title="Distribution across groups" sub="Mean per sample in each group">
              <Bars title={`${node.name} per group`} xLabel="Sample group" yLabel={mode === 'relative' ? 'Mean relative abundance (%)' : 'Mean raw abundance (reads)'} items={grp.map((x) => ({ label: x.g, value: x.v, color: colorOf(x.g) }))} fmtV={mode === 'relative' ? (v) => v.toFixed(2) : undefined} />
            </ChartCard>
          </>
        )}
      </div>
    </div>
  )
}

/* ================= Sample Comparison ================= */
export function Comparison() {
  return (
    <div>
      <PageHeader title="Sample Comparison" desc="Compare two samples or two groups side by side. Results are descriptive and do not establish cause." />
      <Gate module="comparison"><CmpInner /></Gate>
    </div>
  )
}
function CmpInner() {
  const { M, d, levels, level } = useData()
  const [by, setBy] = useState<'groups' | 'samples'>(d.groups.length >= 2 ? 'groups' : 'samples')
  const opts = by === 'groups' ? d.groups : M.samples
  const [a, setA] = useState(opts[0])
  const [b, setB] = useState(opts[1] ?? opts[0])
  useEffect(() => { setA(opts[0]); setB(opts[1] ?? opts[0]) }, [by]) // eslint-disable-line react-hooks/exhaustive-deps
  const members = (v: string) => M.samples.map((_s, i) => i).filter((i) => (by === 'groups' ? M.groupOf[M.samples[i]] === v : M.samples[i] === v))
  const prof = (X: number[][], v: string) => { const m = members(v); return X[0].map((_x, j) => m.reduce((s, i) => s + X[i][j], 0) / Math.max(1, m.length)) }
  const pa = prof(d.R, a)
  const pb = prof(d.R, b)
  const A = useMemo(() => aggregate(M, level), [M, level])
  const RA = useMemo(() => relMatrix(A.X), [A])
  const la = prof(RA, a)
  const lb = prof(RA, b)
  const detected = (v: string) => new Set(M.features.map((_f, j) => j).filter((j) => members(v).some((i) => M.X[i][j] > 0)))
  const sa = detected(a)
  const sb = detected(b)
  const shared = [...sa].filter((j) => sb.has(j))
  const onlyA = [...sa].filter((j) => !sb.has(j))
  const onlyB = [...sb].filter((j) => !sa.has(j))
  const jac = shared.length / Math.max(1, new Set([...sa, ...sb]).size)
  const ord = A.names.map((_n, j) => j).sort((x, y) => Math.max(lb[y], la[y]) - Math.max(lb[x], la[x]))
  const top = ord.slice(0, 8)
  const donut = (p: number[]) => [...top.map((j, i) => ({ label: A.names[j], value: p[j] * 100, color: PALETTE[i % PALETTE.length] })), { label: 'Other', value: ord.slice(8).reduce((s, j) => s + p[j], 0) * 100, color: OTHER }].filter((x) => x.value > 0)
  const alphaOf = (v: string, k: 'observed' | 'shannon' | 'simpson' | 'pielou') => { const vals = members(v).map((i) => d.alpha[i][k]).filter((x): x is number => x !== null); return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null }
  const names = (idx: number[]) => idx.slice(0, 12).map((j) => M.meta[j].organism)
  if (opts.length < 2) return <Note tone="warn">At least two {by} are needed to compare.</Note>
  return (
    <>
      <Card lift={false} className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><span className="label mb-1.5 block">Compare</span><Segmented value={by} onChange={setBy} options={[{ value: 'groups', label: 'Groups' }, { value: 'samples', label: 'Samples' }]} /></div>
          <div className="min-w-40 flex-1"><Select label="First" value={a} onChange={setA} options={opts} /></div>
          <div className="min-w-40 flex-1"><Select label="Second" value={b} onChange={setB} options={opts} /></div>
          <p className="sci text-xs text-muted">Composition shown at <b>{level}</b> level{levels.length === 0 ? ' (no taxonomy resolved)' : ''}.</p>
        </div>
        {a === b && <div className="mt-3"><Note tone="warn">Choose two different {by} to see differences.</Note></div>}
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title={`Composition: ${a}`} sub={by === 'groups' ? 'Mean relative abundance across samples' : 'Relative abundance'}><Donut title={`Composition of ${a}`} data={donut(la)} unit="%" /></ChartCard>
        <ChartCard title={`Composition: ${b}`} sub={by === 'groups' ? 'Mean relative abundance across samples' : 'Relative abundance'}><Donut title={`Composition of ${b}`} data={donut(lb)} unit="%" /></ChartCard>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="p-5"><h3 className="font-bold">Bray-Curtis dissimilarity</h3><div className="mono mt-2 text-3xl font-semibold">{a === b ? '0.000' : fmt(bcPair(pa, pb), 3)}</div><p className="sci mt-2 text-xs text-muted">Between the {by === 'groups' ? 'mean relative profiles' : 'relative profiles'} of {a} and {b}. 0 = identical, 1 = no shared features.</p></Card>
        <Card className="p-5">
          <h3 className="font-bold">Shared and unique features</h3>
          <div className="mono mt-2 grid grid-cols-3 gap-2 text-center"><div><div className="text-2xl font-semibold">{onlyA.length}</div><div className="text-[0.65rem] text-muted">only {a}</div></div><div><div className="text-2xl font-semibold text-cyan">{shared.length}</div><div className="text-[0.65rem] text-muted">shared</div></div><div><div className="text-2xl font-semibold">{onlyB.length}</div><div className="text-[0.65rem] text-muted">only {b}</div></div></div>
          <p className="sci mt-3 text-xs text-muted">Jaccard similarity of detected features: <b className="mono">{fmt(jac, 3)}</b>. A feature counts as detected if its abundance is above 0.</p>
          {onlyA.length > 0 && <p className="sci mt-2 text-xs">Only in {a}: {names(onlyA).join(', ')}{onlyA.length > 12 ? '...' : ''}</p>}
          {onlyB.length > 0 && <p className="sci mt-1 text-xs">Only in {b}: {names(onlyB).join(', ')}{onlyB.length > 12 ? '...' : ''}</p>}
        </Card>
        <Card className="p-5">
          <h3 className="mb-2 font-bold">Alpha diversity{by === 'groups' ? ' (group mean)' : ''}</h3>
          <table className="tbl w-full"><thead><tr><th>Metric</th><th>{a}</th><th>{b}</th></tr></thead><tbody>{([['observed', 'Observed'], ['shannon', 'Shannon'], ['simpson', 'Simpson (1-D)'], ['pielou', 'Pielou']] as const).map(([k, l]) => <tr key={k}><td>{l}</td><td className="mono">{fmt(alphaOf(a, k), 3)}</td><td className="mono">{fmt(alphaOf(b, k), 3)}</td></tr>)}</tbody></table>
        </Card>
      </div>
      <Card lift={false} className="mt-5 p-5">
        <h3 className="mb-3 font-bold">Relative abundance comparison ({level})</h3>
        <DataTable initialSort={{ key: 'diff', dir: -1 }} rows={A.names.map((n, j) => ({ n, a: la[j] * 100, b: lb[j] * 100, diff: Math.abs(lb[j] - la[j]) * 100, signed: (lb[j] - la[j]) * 100 })).filter((r) => r.a > 0 || r.b > 0)} cols={[
          { key: 'n', label: 'Taxon' },
          { key: 'a', label: `${a} (%)`, mono: true, align: 'right', render: (r) => fmt(r.a, 3) },
          { key: 'b', label: `${b} (%)`, mono: true, align: 'right', render: (r) => fmt(r.b, 3) },
          { key: 'diff', label: `Difference (${b} - ${a}, pp)`, mono: true, align: 'right', render: (r) => (r.signed > 0 ? '+' : '') + fmt(r.signed, 3) },
        ]} />
        <p className="sci mt-3 text-xs text-muted">pp = percentage points. These are observed differences in relative abundance, not tests of significance, and association does not imply causation.</p>
      </Card>
    </>
  )
}

/* ================= Advanced ================= */
export function Advanced() {
  return (
    <div>
      <PageHeader title="Advanced Analytics" desc="Each tool is labelled by its real status. Experimental tools are descriptive and are not statistical tests." />
      <Gate module="advanced"><AdvInner /></Gate>
    </div>
  )
}
function AdvInner() {
  const { M, d, levels, level } = useData()
  const A = useMemo(() => aggregate(M, level), [M, level])
  const RA = useMemo(() => relMatrix(A.X), [A])
  const [ga, setGa] = useState(d.groups[0])
  const [gb, setGb] = useState(d.groups[1] ?? d.groups[0])
  const mean = (g: string) => { const ix = M.samples.map((_s, i) => i).filter((i) => M.groupOf[M.samples[i]] === g); return A.names.map((_n, j) => ix.reduce((s, i) => s + RA[i][j], 0) / Math.max(1, ix.length)) }
  const ma = mean(ga)
  const mb = mean(gb)
  const EPS = 1e-4
  const de = A.names.map((n, j) => ({ n, a: ma[j] * 100, b: mb[j] * 100, lfc: Math.log2((mb[j] + EPS) / (ma[j] + EPS)) })).filter((r) => r.a > 0 || r.b > 0)
  const co = useMemo(() => {
    if (M.samples.length < 6) return []
    const mm = A.names.map((_n, j) => RA.reduce((s, r) => s + r[j], 0) / RA.length)
    const top = A.names.map((_n, j) => j).filter((j) => A.names[j] !== 'Unassigned').sort((x, y) => mm[y] - mm[x]).slice(0, 15)
    const out: { p: string; rho: number }[] = []
    for (let x = 0; x < top.length; x++) for (let y = x + 1; y < top.length; y++) { const r = spearman(RA.map((s) => s[top[x]]), RA.map((s) => s[top[y]])); if (Number.isFinite(r)) out.push({ p: `${A.names[top[x]]} / ${A.names[top[y]]}`, rho: r }) }
    return out.sort((x, y) => Math.abs(y.rho) - Math.abs(x.rho)).slice(0, 15)
  }, [A, RA, M.samples.length])
  const planned = [['Functional Prediction', 'Would infer functional potential from taxonomy. Requires a reference-based method that is not implemented.'], ['Machine Learning Insights', 'Would train models on abundance profiles. Needs adequate sample sizes and validation; not implemented.'], ['Custom Analysis', 'User-defined analysis scripts are not available in this prototype.']]
  return (
    <div className="space-y-5">
      <Card lift={false} className="flex flex-wrap items-center gap-2 p-4 text-xs"><Badge tone="ok">Implemented</Badge><Badge tone="warn">Experimental</Badge><Badge tone="violet">Demo</Badge><Badge tone="mute">Planned</Badge><span className="sci text-muted">Only experimental tools have working computations on this page; no tool here shows fabricated demo values.</span></Card>
      <Card lift={false} className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">Differential Abundance (descriptive)</h3><Badge tone="warn">Experimental</Badge></div>
        <Note tone="warn">Only the observed log2 fold change of mean relative abundance is shown ({level} level, pseudocount {EPS}). <b>No p-values, significance testing or multiple-testing correction</b> are performed, so none of these differences should be called significant.</Note>
        {d.groups.length < 2 ? <p className="mt-3 text-sm text-muted">At least two groups are required.</p> : (
          <div className="mt-4">
            <div className="mb-3 flex flex-wrap gap-3"><div className="min-w-40"><Select label="Group A (reference)" value={ga} onChange={setGa} options={d.groups} /></div><div className="min-w-40"><Select label="Group B" value={gb} onChange={setGb} options={d.groups} /></div></div>
            {levels.length === 0 ? <Note tone="warn">No taxonomy resolved.</Note> : <DataTable initialSort={{ key: 'lfc', dir: -1 }} rows={de} cols={[{ key: 'n', label: 'Taxon' }, { key: 'a', label: `${ga} mean %`, mono: true, align: 'right', render: (r) => fmt(r.a, 3) }, { key: 'b', label: `${gb} mean %`, mono: true, align: 'right', render: (r) => fmt(r.b, 3) }, { key: 'lfc', label: 'log2 FC (B/A)', mono: true, align: 'right', render: (r) => fmt(r.lfc, 2) }]} />}
          </div>
        )}
      </Card>
      <Card lift={false} className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">Co-occurrence (Spearman rank correlation)</h3><Badge tone="warn">Experimental</Badge></div>
        <Note tone="warn">Correlations between relative abundances do not represent direct microbial interactions or causation, and are distorted by compositionality. No network graph or p-values are produced; only the strongest pairwise rank correlations among the top 15 {level} taxa are listed.</Note>
        <div className="mt-4">{co.length ? <DataTable search={false} rows={co} cols={[{ key: 'p', label: 'Taxon pair' }, { key: 'rho', label: 'Spearman rho', mono: true, align: 'right', render: (r) => fmt(r.rho, 3) }]} /> : <p className="text-sm text-muted">At least 6 samples are needed for meaningful rank correlations.</p>}</div>
      </Card>
      <div className="grid gap-5 md:grid-cols-3">
        {planned.map(([t, dsc]) => <Card key={t} className="p-5 opacity-80"><div className="flex items-center justify-between gap-2"><h3 className="font-bold">{t}</h3><Badge tone="mute">Planned</Badge></div><p className="sci mt-2 text-sm text-muted">{dsc}</p></Card>)}
      </div>
    </div>
  )
}
