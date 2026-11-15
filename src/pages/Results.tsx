import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { MODULES, useApp, type Dataset, type ModuleId } from '../store'
import { BoxPlot, Donut, PALETTE, Scatter } from '../charts'
import { Badge, Btn, Card, DataTable, PageHeader, Select, Tabs, Skeleton, download, when } from '../ui'
import { Gate, Note, compose, useData } from './common'
import { LEVELS, bcPair, bytes, fmt, pcoa, relMatrix, toCSV } from '../lib/science'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'dataset', label: 'Dataset Information' },
  { id: 'composition', label: 'Composition' },
  { id: 'alpha', label: 'Alpha Diversity' },
  { id: 'beta', label: 'Beta Diversity' },
  { id: 'taxonomy', label: 'Taxonomic Results' },
  { id: 'comparison', label: 'Sample Comparison' },
  { id: 'validation', label: 'Validation' },
  { id: 'methods', label: 'Methodology and Limitations' },
] as const
type Tab = (typeof TABS)[number]['id']

export const LIMITS = [
  'Abundances are treated as sequencing read counts (or equivalent). They are not direct cell counts.',
  'Relative abundance describes proportions within a sample and is not absolute organism abundance.',
  'Missing abundances are not treated as zero; such rows are excluded. Sample-feature pairs absent from the long-format table are treated as not detected (0).',
  'Duplicate sample-feature rows are summed. Negative values block loading; non-numeric rows are excluded.',
  'Counts are not rarefied or normalised beyond per-sample proportions, so metrics can reflect sequencing depth.',
  'Higher diversity does not automatically mean a healthier or better microbiome.',
  'No statistical significance tests (p-values, PERMANOVA) are computed. Differences shown are descriptive and association does not imply causation.',
  'The platform does not perform sequencing or bioinformatic taxonomy assignment, and does not diagnose disease.',
]
export const METHODS = [
  'Relative abundance (%) = feature abundance / total abundance in the sample x 100.',
  'Shannon index H = -sum(p ln p), natural logarithm. Simpson index is reported as 1 - D where D = sum(p^2). Observed features = count of features with abundance > 0. Pielou evenness J = H / ln(S).',
  'Bray-Curtis dissimilarity = sum|p_ik - p_jk| / sum(p_ik + p_jk) on relative abundances.',
  'PCoA: classical principal coordinates analysis of the Bray-Curtis matrix; explained variation = eigenvalue / sum of positive eigenvalues. NMDS is not implemented.',
  'Taxonomic levels are read from the optional lineage column; features without a value at a level are labelled Unassigned (taxonomy is never guessed).',
]

export function Results() {
  return (
    <div>
      <PageHeader title="Results" desc="Reopen the results generated for the active dataset. Each dataset keeps its own results." />
      <Gate module="any"><Inner /></Gate>
    </div>
  )
}
function Inner() {
  const { ds } = useData()
  const [tab, setTab] = useState<Tab>('overview')
  const [runId, setRunId] = useState(ds.runs[0]?.id)
  const run = ds.runs.find((r) => r.id === runId) ?? ds.runs[0]
  const inc = (m: ModuleId) => run?.modules.includes(m)
  return (
    <>
      <Card lift={false} className="mb-4 flex flex-wrap items-center gap-3 p-4 text-sm">
        <span><span className="label mr-2">Dataset</span><b>{ds.name}</b> <span className="mono text-xs text-muted">{ds.id}</span></span>
        <span><span className="label mr-2">Generated</span><span className="mono text-xs">{when(run.at)}</span></span>
        <div className="ml-auto min-w-52"><Select value={run.id} onChange={setRunId} options={ds.runs.map((r, i) => ({ value: r.id, label: `Run ${ds.runs.length - i} - ${when(r.at)}` }))} /></div>
      </Card>
      <Tabs value={tab} onChange={setTab} tabs={TABS as unknown as { id: Tab; label: string }[]} />
      <div key={tab + run.id} className="page-in mt-3">
        {tab === 'overview' && <Overview ds={ds} />}
        {tab === 'dataset' && <Info ds={ds} />}
        {tab === 'composition' && (inc('composition') ? <Comp /> : <NotIn />)}
        {tab === 'alpha' && (inc('alpha') ? <AlphaT /> : <NotIn />)}
        {tab === 'beta' && (inc('beta') ? <BetaT /> : <NotIn />)}
        {tab === 'taxonomy' && (inc('taxonomy') ? <TaxT /> : <NotIn />)}
        {tab === 'comparison' && (inc('comparison') ? <CmpT /> : <NotIn />)}
        {tab === 'validation' && <Val ds={ds} />}
        {tab === 'methods' && <Methods />}
      </div>
    </>
  )
}
const NotIn = () => <Note tone="warn">This module was not included in the selected run. Choose another run above or run it from the Analysis page.</Note>
function Overview({ ds }: { ds: Dataset }) {
  const { setActive } = useApp()
  void setActive
  return (
    <Card lift={false} className="p-5">
      <h3 className="mb-3 font-bold">Analysis runs for {ds.name}</h3>
      <DataTable search={false} pageSize={6} rows={ds.runs} cols={[{ key: 'at', label: 'Generated', value: (r) => r.at, render: (r) => when(r.at) }, { key: 'm', label: 'Modules', value: (r) => r.modules.length, render: (r) => r.modules.map((m) => MODULES.find((x) => x.id === m)!.label).join(', ') }]} />
      <p className="sci mt-3 text-xs text-muted">Results are recomputed deterministically from this dataset only. Use the run selector above to inspect what each run included.</p>
    </Card>
  )
}
function Info({ ds }: { ds: Dataset }) {
  const rows: [string, string][] = [['Name', ds.name], ['Dataset ID', ds.id], ['Type', ds.type === 'Sample' ? 'Illustrative demo sample' : 'User upload'], ['File', `${ds.fileName} (${bytes(ds.size)})`], ['Rows', `${ds.recs.length.toLocaleString()} (${ds.M.usedRows.toLocaleString()} used)`], ['Samples', String(ds.M.samples.length)], ['Features', String(ds.M.features.length)], ['Groups', [...new Set(Object.values(ds.M.groupOf))].join(', ')], ['Description', ds.description || 'None']]
  return <Card lift={false} className="p-5"><dl className="sci grid grid-cols-[140px_1fr] gap-y-2 text-sm">{rows.map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd className="mono text-[0.82rem] break-words">{v}</dd></Fragment>)}</dl></Card>
}
function useLevel() {
  const { M, d, levels, level, colorOf } = useData()
  return { M, d, levels, level, colorOf }
}
function Comp() {
  const { M, level } = useLevel()
  const all = M.samples.map((_s, i) => i)
  const c = compose(M, level, 8, all)
  const mean = c.names.map((_n, j) => (c.rel.reduce((a, r) => a + r[j], 0) / c.rel.length) * 100)
  return <Card lift={false} className="p-5"><h3 className="mb-3 font-bold">Mean composition ({level})</h3><Donut title={`Mean composition at ${level} level`} data={c.names.map((n, j) => ({ label: n, value: mean[j], color: c.colors[j] }))} unit="%" /></Card>
}
function AlphaT() {
  const { d } = useData()
  return <Card lift={false} className="p-5"><DataTable rows={d.alpha} cols={[{ key: 'sample', label: 'Sample', mono: true }, { key: 'group', label: 'Group' }, { key: 'observed', label: 'Observed', mono: true, align: 'right' }, { key: 'shannon', label: 'Shannon', mono: true, align: 'right', render: (r) => fmt(r.shannon, 4) }, { key: 'simpson', label: 'Simpson (1-D)', mono: true, align: 'right', render: (r) => fmt(r.simpson, 4) }, { key: 'pielou', label: 'Pielou', mono: true, align: 'right', value: (r) => r.pielou ?? -1, render: (r) => fmt(r.pielou, 4) }]} /></Card>
}
function BetaT() {
  const { d, M, colorOf } = useData()
  const pc = useMemo(() => pcoa(d.D), [d])
  if (!pc) return <Note tone="warn">PCoA could not be computed for this dataset.</Note>
  return <Card lift={false} className="p-5"><Scatter title="PCoA of Bray-Curtis dissimilarity" xLabel={`PCoA 1 (${(pc.explained[0] * 100).toFixed(1)}%)`} yLabel={`PCoA 2 (${(pc.explained[1] * 100).toFixed(1)}%)`} points={M.samples.map((s, i) => ({ x: pc.coords[i][0], y: pc.coords[i][1], label: s, group: M.groupOf[s], color: colorOf(M.groupOf[s]) }))} legend={d.groups.map((g) => ({ label: g, color: colorOf(g) }))} /></Card>
}
function TaxT() {
  const { M, d } = useData()
  const rows = M.features.map((f, j) => ({ f, o: M.meta[j].organism, rank: M.meta[j].rank, rel: (d.R.reduce((a, r) => a + r[j], 0) / d.R.length) * 100, raw: M.X.reduce((a, r) => a + r[j], 0) }))
  return <Card lift={false} className="p-5"><DataTable initialSort={{ key: 'rel', dir: -1 }} rows={rows} cols={[{ key: 'f', label: 'Feature', mono: true }, { key: 'o', label: 'Organism' }, { key: 'rank', label: 'Rank' }, { key: 'raw', label: 'Total reads', mono: true, align: 'right', render: (r) => r.raw.toLocaleString() }, { key: 'rel', label: 'Mean relative abundance (%)', mono: true, align: 'right', render: (r) => fmt(r.rel, 3) }]} /></Card>
}
function groupBC(M: Dataset['M'], R: number[][], groups: string[]) {
  const prof = (g: string) => { const ix = M.samples.map((_s, i) => i).filter((i) => M.groupOf[M.samples[i]] === g); return R[0].map((_x, j) => ix.reduce((s, i) => s + R[i][j], 0) / ix.length) }
  const P = groups.map(prof)
  return groups.flatMap((a, i) => groups.slice(i + 1).map((b, k) => ({ pair: `${a} vs ${b}`, bc: bcPair(P[i], P[i + 1 + k]) })))
}
function CmpT() {
  const { M, d } = useData()
  const rows = groupBC(M, d.R, d.groups)
  if (!rows.length) return <Note tone="warn">At least two groups are needed for group comparison.</Note>
  return <Card lift={false} className="p-5"><h3 className="mb-3 font-bold">Bray-Curtis between group mean profiles</h3><DataTable search={false} rows={rows} cols={[{ key: 'pair', label: 'Groups' }, { key: 'bc', label: 'Bray-Curtis', mono: true, align: 'right', render: (r) => fmt(r.bc, 4) }]} /></Card>
}
function Val({ ds }: { ds: Dataset }) {
  return <Card lift={false} className="divide-y divide-line p-2">{ds.checks.map((c) => <div key={c.id} className="flex items-start gap-3 p-3 text-sm"><Badge tone={c.status === 'pass' ? 'ok' : c.status === 'warn' ? 'warn' : 'bad'}>{c.status}</Badge><div><b>{c.title}</b>{c.count > 0 && <span className="mono text-xs text-muted"> ({c.count} affected)</span>}<p className="sci text-muted">{c.explanation}</p></div></div>)}</Card>
}
function Methods() {
  return <div className="grid gap-5 lg:grid-cols-2"><Card lift={false} className="p-5"><h3 className="mb-3 font-bold">Methodology</h3><ul className="sci list-disc space-y-2 pl-5 text-sm text-muted">{METHODS.map((m) => <li key={m}>{m}</li>)}</ul></Card><Card lift={false} className="p-5"><h3 className="mb-3 font-bold">Limitations</h3><ul className="sci list-disc space-y-2 pl-5 text-sm text-muted">{LIMITS.map((m) => <li key={m}>{m}</li>)}</ul></Card></div>
}

/* ================= Reports ================= */
const KINDS = [
  { id: 'complete', label: 'Complete Report', secs: ['dataset', 'methods', 'composition', 'alpha', 'beta', 'comparison', 'validation', 'limitations'] },
  { id: 'composition', label: 'Composition Report', secs: ['dataset', 'methods', 'composition', 'limitations'] },
  { id: 'alpha', label: 'Alpha Diversity Report', secs: ['dataset', 'methods', 'alpha', 'limitations'] },
  { id: 'beta', label: 'Beta Diversity Report', secs: ['dataset', 'methods', 'beta', 'limitations'] },
  { id: 'comparison', label: 'Sample Comparison Report', secs: ['dataset', 'methods', 'comparison', 'limitations'] },
  { id: 'validation', label: 'Validation Report', secs: ['dataset', 'validation', 'limitations'] },
]
const SECLABEL: Record<string, string> = { dataset: 'Dataset details', methods: 'Methods', composition: 'Composition', alpha: 'Alpha diversity', beta: 'Beta diversity', comparison: 'Sample comparison', validation: 'Validation warnings', limitations: 'Limitations' }

export function Reports() {
  return (
    <div>
      <PageHeader title="Reports" desc="Build a report from computed results for the active dataset and export what the platform genuinely supports." />
      <Gate module="any"><ReportsInner /></Gate>
    </div>
  )
}
function ReportsInner() {
  const { ds, M, d, level, colorOf } = useData()
  const { reports, addReport, notify, settings, theme } = useApp()
  const [kind, setKind] = useState('complete')
  const [title, setTitle] = useState('')
  const [secs, setSecs] = useState<string[]>(KINDS[0].secs)
  const [busy, setBusy] = useState(false)
  const [gen, setGen] = useState<string | null>(null)
  const [fmtX, setFmtX] = useState<string>(settings.exportFormat)
  const [chart, setChart] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const myReports = reports.filter((r) => r.datasetId === ds.id)
  const ttl = title || `${KINDS.find((k) => k.id === kind)!.label}: ${ds.name}`
  const avail = (s: string) => !['composition', 'alpha', 'beta', 'comparison'].includes(s) || !!ds.done[s as ModuleId]
  const pickKind = (k: string) => { setKind(k); setSecs(KINDS.find((x) => x.id === k)!.secs); setGen(null) }
  const use = secs.filter(avail)
  const all = M.samples.map((_s, i) => i)
  const c = useMemo(() => compose(M, level, 8, all), [M, level]) // eslint-disable-line react-hooks/exhaustive-deps
  const pc = useMemo(() => pcoa(d.D), [d])
  const gBC = useMemo(() => groupBC(M, d.R, d.groups), [M, d])
  const meanRel = c.names.map((_n, j) => (c.rel.reduce((a, r) => a + r[j], 0) / c.rel.length) * 100)
  const generate = () => {
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      addReport({ datasetId: ds.id, title: ttl, kind, sections: use })
      setGen(ttl)
      notify('report', `Report generated: ${ttl}`, ds.id)
    }, 800)
  }
  const fname = (ext: string) => `${settings.prefix}-${ds.id}-${kind}.${ext}`
  const svgs = () => [...(ref.current?.querySelectorAll('svg[data-chart]') ?? [])] as SVGSVGElement[]
  const toSvg = (s: SVGSVGElement) => {
    const cl = s.cloneNode(true) as SVGSVGElement
    const vb = s.viewBox.baseVal
    cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    cl.setAttribute('width', String(vb.width * 2))
    cl.setAttribute('height', String(vb.height * 2))
    cl.removeAttribute('style')
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', theme === 'dark' ? '#141a26' : '#ffffff')
    cl.insertBefore(bg, cl.firstChild)
    return { text: new XMLSerializer().serializeToString(cl), w: vb.width * 2, h: vb.height * 2 }
  }
  const doExport = () => {
    if (fmtX === 'pdf') { notify('info', 'Use "Save as PDF" in the print dialog to export this report.'); setTimeout(() => window.print(), 300) }
    else if (fmtX === 'csv') {
      const parts: string[] = []
      if (use.includes('dataset')) parts.push('# Dataset', toCSV(['field', 'value'], [['name', ds.name], ['id', ds.id], ['samples', M.samples.length], ['features', M.features.length]]))
      if (use.includes('composition')) parts.push('', `# Composition (${level}) mean relative abundance %`, toCSV([level, 'mean_relative_abundance_pct'], c.names.map((n, j) => [n, +meanRel[j].toFixed(4)])))
      if (use.includes('alpha')) parts.push('', '# Alpha diversity', toCSV(['sample', 'group', 'observed', 'shannon', 'simpson_1_minus_D', 'pielou'], d.alpha.map((a) => [a.sample, a.group, a.observed, a.shannon, a.simpson, a.pielou])))
      if (use.includes('beta')) parts.push('', '# Bray-Curtis matrix', toCSV(['sample', ...M.samples], M.samples.map((s, i) => [s, ...d.D[i]])))
      if (use.includes('comparison')) parts.push('', '# Group Bray-Curtis', toCSV(['groups', 'bray_curtis'], gBC.map((g) => [g.pair, g.bc])))
      if (use.includes('validation')) parts.push('', '# Validation', toCSV(['check', 'status', 'affected'], ds.checks.map((k) => [k.title, k.status, k.count])))
      download(fname('csv'), parts.join('\n'))
    } else {
      const s = svgs()[chart]
      if (!s) return notify('error', 'No chart is available in this report to export.')
      const { text, w, h } = toSvg(s)
      if (fmtX === 'svg') download(fname('svg'), text, 'image/svg+xml')
      else {
        const img = new Image()
        img.onload = () => {
          const cv = document.createElement('canvas')
          cv.width = w; cv.height = h
          cv.getContext('2d')!.drawImage(img, 0, 0, w, h)
          cv.toBlob((b) => b && download(fname('png'), b, 'image/png'))
        }
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text)
      }
    }
  }
  const [chartTitles, setChartTitles] = useState<string[]>([])
  useEffect(() => { setChartTitles(svgs().map((s) => s.getAttribute('data-chart') ?? 'Chart')) }, [use.join(), busy, gen, fmtX]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <div className="space-y-5 xl:col-span-2">
        <Card lift={false} className="p-5">
          <h3 className="mb-3 font-bold">Report type</h3>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{KINDS.map((k) => <button key={k.id} onClick={() => pickKind(k.id)} className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${kind === k.id ? 'border-cyan/60 bg-cyan/10' : 'border-line hover:border-brand/50'}`} aria-pressed={kind === k.id}>{k.label}</button>)}</div>
        </Card>
        <Card lift={false} className="space-y-4 p-5">
          <label className="block"><span className="label mb-1.5 block">Report title</span><input className="input" value={title} placeholder={ttl} onChange={(e) => setTitle(e.target.value)} /></label>
          <div><span className="label mb-2 block">Sections</span>
            <div className="grid gap-1.5">{Object.keys(SECLABEL).map((s) => <label key={s} className={`flex items-center gap-2 text-sm ${avail(s) ? '' : 'opacity-50'}`}><input type="checkbox" className="h-4 w-4 accent-cyan-400" disabled={!avail(s)} checked={secs.includes(s) && avail(s)} onChange={(e) => { setSecs(e.target.checked ? [...secs, s] : secs.filter((x) => x !== s)); setGen(null) }} />{SECLABEL[s]}{!avail(s) && <span className="text-xs text-faint">(not run for this dataset)</span>}</label>)}</div>
          </div>
          <Btn variant="primary" className="w-full" onClick={generate} disabled={busy || !use.length}>{busy ? <><Loader2 size={15} className="animate-spin" /> Generating...</> : <><FileText size={15} /> Generate Report</>}</Btn>
        </Card>
        <Card lift={false} className="space-y-3 p-5">
          <h3 className="font-bold">Export</h3>
          <div className="flex flex-wrap gap-2"><div className="min-w-32 flex-1"><Select value={fmtX} onChange={setFmtX} options={[{ value: 'pdf', label: 'PDF (print dialog)' }, { value: 'csv', label: 'CSV (tables)' }, { value: 'svg', label: 'SVG (one chart)' }, { value: 'png', label: 'PNG (one chart)' }]} /></div></div>
          {(fmtX === 'svg' || fmtX === 'png') && <Select value={String(chart)} onChange={(v) => setChart(+v)} options={chartTitles.map((t, i) => ({ value: String(i), label: t }))} />}
          <Btn className="w-full" onClick={doExport} disabled={!gen}><Download size={15} /> Export {fmtX.toUpperCase()}</Btn>
          {!gen && <p className="text-xs text-muted">Generate the report first to enable export.</p>}
        </Card>
        <Card lift={false} className="p-5"><h3 className="mb-2 font-bold">Generated for this dataset</h3>{myReports.length ? <ul className="space-y-1.5 text-sm">{myReports.map((r) => <li key={r.id} className="flex justify-between gap-3"><span className="truncate">{r.title}</span><span className="shrink-0 text-xs text-muted">{when(r.at)}</span></li>)}</ul> : <p className="text-sm text-muted">None yet.</p>}</Card>
      </div>
      <div className="xl:col-span-3">
        {busy ? <Card lift={false} className="space-y-3 p-6"><Skeleton h={36} /><Skeleton h={160} /><Skeleton h={220} /></Card> : (
          <div ref={ref} className="print-area card p-6 md:p-8" style={{ background: 'var(--solid)' }}>
            <div className="mb-1 flex items-center gap-2"><Badge tone={gen ? 'ok' : 'mute'}>{gen ? 'Generated' : 'Preview'}</Badge><span className="mono text-xs text-muted">{ds.id}</span></div>
            <h2 className="text-2xl font-extrabold">{ttl}</h2>
            <p className="sci text-xs text-muted">Microbiome Atlas - computed in-browser from the dataset below. {gen ? '' : 'Not yet generated.'}</p>
            {use.includes('dataset') && <Sec t="Dataset details"><table className="tbl w-full"><tbody>{[['Dataset', ds.name], ['File', `${ds.fileName} (${bytes(ds.size)})`], ['Samples', M.samples.length], ['Features', M.features.length], ['Groups', d.groups.join(', ')], ['Rows used', `${M.usedRows} of ${ds.recs.length}`], ['Source', ds.type === 'Sample' ? 'Illustrative demo dataset' : 'User upload']].map(([k, v]) => <tr key={k as string}><td className="text-muted">{k}</td><td className="mono">{v}</td></tr>)}</tbody></table></Sec>}
            {use.includes('methods') && <Sec t="Methods"><ul className="sci list-disc space-y-1 pl-5 text-sm text-muted">{METHODS.map((m) => <li key={m}>{m}</li>)}</ul></Sec>}
            {use.includes('composition') && <Sec t={`Composition (${level})`}><Donut title={`Mean composition at ${level} level`} data={c.names.map((n, j) => ({ label: n, value: meanRel[j], color: c.colors[j] }))} unit="%" />
              <table className="tbl mt-3 w-full"><thead><tr><th>{level}</th><th>Mean relative abundance (%)</th></tr></thead><tbody>{c.names.map((n, j) => <tr key={n}><td>{n}</td><td className="mono">{fmt(meanRel[j], 3)}</td></tr>)}</tbody></table></Sec>}
            {use.includes('alpha') && <Sec t="Alpha diversity"><BoxPlot title="Shannon index by group" yLabel="Shannon index (H')" groups={d.groups.map((g) => ({ name: g, color: colorOf(g), values: d.alpha.filter((a) => a.group === g).map((a) => a.shannon) }))} />
              <div className="mt-3 overflow-x-auto"><table className="tbl w-full"><thead><tr><th>Sample</th><th>Group</th><th>Obs.</th><th>Shannon</th><th>Simpson (1-D)</th><th>Pielou</th></tr></thead><tbody>{d.alpha.map((a) => <tr key={a.sample}><td className="mono">{a.sample}</td><td>{a.group}</td><td className="mono">{a.observed}</td><td className="mono">{fmt(a.shannon, 3)}</td><td className="mono">{fmt(a.simpson, 3)}</td><td className="mono">{fmt(a.pielou, 3)}</td></tr>)}</tbody></table></div></Sec>}
            {use.includes('beta') && <Sec t="Beta diversity">{pc ? <Scatter title="PCoA of Bray-Curtis dissimilarity" xLabel={`PCoA 1 (${(pc.explained[0] * 100).toFixed(1)}%)`} yLabel={`PCoA 2 (${(pc.explained[1] * 100).toFixed(1)}%)`} points={M.samples.map((s, i) => ({ x: pc.coords[i][0], y: pc.coords[i][1], label: s, group: M.groupOf[s], color: colorOf(M.groupOf[s]) }))} legend={d.groups.map((g) => ({ label: g, color: colorOf(g) }))} /> : <p className="text-sm text-muted">PCoA not available for this dataset.</p>}</Sec>}
            {use.includes('comparison') && <Sec t="Sample comparison">{gBC.length ? <table className="tbl w-full"><thead><tr><th>Groups</th><th>Bray-Curtis (mean profiles)</th></tr></thead><tbody>{gBC.map((g) => <tr key={g.pair}><td>{g.pair}</td><td className="mono">{fmt(g.bc, 4)}</td></tr>)}</tbody></table> : <p className="text-sm text-muted">Only one group present.</p>}<p className="sci mt-2 text-xs text-muted">Descriptive only; no significance test.</p></Sec>}
            {use.includes('validation') && <Sec t="Validation warnings">{ds.checks.filter((k) => k.status !== 'pass').length ? <ul className="sci list-disc space-y-1 pl-5 text-sm">{ds.checks.filter((k) => k.status !== 'pass').map((k) => <li key={k.id}><b>{k.title}</b> ({k.count} affected): {k.explanation}</li>)}</ul> : <p className="text-sm text-muted">All validation checks passed.</p>}</Sec>}
            {use.includes('limitations') && <Sec t="Limitations"><ul className="sci list-disc space-y-1 pl-5 text-sm text-muted">{LIMITS.map((m) => <li key={m}>{m}</li>)}</ul></Sec>}
          </div>
        )}
      </div>
      <span hidden>{PALETTE.length}{LEVELS.length}{String(!!relMatrix)}</span>
    </div>
  )
}
function Sec({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t-2 border-line/60 pt-5">
      <h3 className="mb-3 text-lg font-extrabold tracking-tight text-ink">{t}</h3>
      {children}
    </section>
  )
}
