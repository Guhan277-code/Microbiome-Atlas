import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, FileSpreadsheet, Loader2, Play, RefreshCw, Trash2, Upload, XCircle } from 'lucide-react'
import { MODULES, useApp, type ModuleId } from '../store'
import { SAMPLES, sampleCSV } from '../lib/samples'
import { FIELDS, bytes, buildMatrix, fmt, mapRecords, parseCSV, validate, type Field } from '../lib/science'
import { Badge, Btn, Card, DataTable, Field as F, Logo, Modal, Segmented, Select, ThemeSwitch } from '../ui'

const STEPS = ['upload', 'configure', 'validate', 'preview', 'analysis'] as const
const LABELS = ['Upload', 'Configure', 'Validate', 'Preview', 'Analyse']

export default function Wizard({ step }: { step: string }) {
  const { draft, go, datasets, active, setDraft } = useApp()
  const idx = Math.max(0, STEPS.indexOf(step as (typeof STEPS)[number]))
  const max = draft ? Math.max(draft.maxStep, 0) : 0
  useEffect(() => {
    if (!location.hash.startsWith('#/new')) return
    if (idx > 0 && !draft) go('/new/upload')
    else if (draft && idx > draft.maxStep) go('/new/' + STEPS[draft.maxStep])
  }, [idx, draft, go])
  const analysis = useMemo(() => {
    if (!draft) return null
    const recs = mapRecords(draft.raw, draft.mapping)
    const checks = validate(draft.raw, draft.mapping, recs)
    return { recs, checks, M: buildMatrix(recs) }
  }, [draft])
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-[min(1100px,calc(100%-24px))] items-center justify-between py-5">
        <button onClick={() => go(active ? '/app/overview' : '/')}><Logo /></button>
        <div className="flex items-center gap-2">
          {active && <Btn size="sm" onClick={() => go('/app/overview')}>Back to workspace</Btn>}
          <ThemeSwitch />
        </div>
      </header>
      <main className="mx-auto w-[min(1100px,calc(100%-24px))] pb-16">
        <nav aria-label="Progress" className="card mb-6 overflow-x-auto p-3">
          <ol className="flex min-w-[520px] items-center">
            {LABELS.map((l, i) => {
              const done = i < max || (i < idx)
              const cur = i === idx
              const can = draft ? i <= max : i === 0
              return (
                <li key={l} className="flex flex-1 items-center last:flex-none">
                  <button disabled={!can} onClick={() => go('/new/' + STEPS[i])} aria-current={cur ? 'step' : undefined} className={`flex items-center gap-2 rounded-full px-2 py-1.5 text-sm font-semibold transition ${cur ? 'text-ink' : can ? 'text-muted hover:text-ink' : 'text-faint opacity-60'}`}>
                    <span className={`mono grid h-7 w-7 place-items-center rounded-full border text-xs transition-all ${cur ? 'border-transparent bg-gradient-to-br from-brand to-cyan text-[#04101f] shadow-[0_0_18px_rgba(0,212,255,.6)]' : done ? 'border-ok bg-ok/20 text-ok' : 'border-line'}`}>{done && !cur ? <Check size={14} /> : i + 1}</span>
                    {l}
                  </button>
                  {i < 4 && <i className={`mx-1 h-px flex-1 ${i < max ? 'bg-ok/60' : 'bg-line'}`} />}
                </li>
              )
            })}
          </ol>
        </nav>
        <div key={step} className="page-in">
          {idx === 0 && <UploadStep />}
          {draft && analysis && idx === 1 && <Configure analysis={analysis} />}
          {draft && analysis && idx === 2 && <Validate analysis={analysis} />}
          {draft && analysis && idx === 3 && <Preview analysis={analysis} />}
          {draft && analysis && idx === 4 && <Analyse analysis={analysis} />}
        </div>
        <p className="sr-only">{datasets.length} datasets loaded</p>
        <span hidden>{String(!!setDraft)}</span>
      </main>
    </div>
  )
}
type An = { recs: ReturnType<typeof mapRecords>; checks: ReturnType<typeof validate>; M: ReturnType<typeof buildMatrix> }

function Nav({ back, next, nextLabel = 'Continue', disabled, note }: { back?: () => void; next: () => void; nextLabel?: string; disabled?: boolean; note?: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      {back ? <Btn onClick={back}><ArrowLeft size={15} /> Back</Btn> : <span />}
      <div className="flex items-center gap-3">
        {note && <span className="text-xs text-warn">{note}</span>}
        <Btn variant="primary" disabled={disabled} onClick={next}>{nextLabel} <ArrowRight size={15} /></Btn>
      </div>
    </div>
  )
}

function UploadStep() {
  const { draft, loadFile, loadSample, setDraft, go, notify } = useApp()
  const [drag, setDrag] = useState(false)
  const [prog, setProg] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [prev, setPrev] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const readFile = (f: File) => {
    setErr('')
    if (!/\.csv$/i.test(f.name)) {
      setErr(`"${f.name}" is not a .csv file. Only CSV abundance tables are supported (FASTQ and other formats are not).`)
      notify('error', `Upload rejected: ${f.name} is not a CSV file.`)
      return
    }
    setProg(0)
    f.text().then((text) => {
      let p = 0
      const t = setInterval(() => {
        p += 20
        setProg(Math.min(p, 100))
        if (p >= 100) {
          clearInterval(t)
          const e = loadFile(f.name, f.size, text)
          setProg(null)
          if (e) {
            setErr(e)
            notify('error', e)
          } else notify('upload', `Uploaded ${f.name} (${bytes(f.size)}).`)
        }
      }, 90)
    })
  }
  const previewRaw = useMemo(() => (prev ? parseCSV(sampleCSV(SAMPLES.find((s) => s.key === prev)!)) : null), [prev])
  const sampleStats = useMemo(
    () =>
      SAMPLES.map((s) => {
        const text = sampleCSV(s)
        const rec = mapRecords(parseCSV(text), { sample_id: 'sample_id', feature_id: 'feature_id', organism: 'organism', taxonomic_rank: 'taxonomic_rank', abundance: 'abundance', sample_group: 'sample_group', lineage: 'lineage' })
        return { s, size: text.length, samples: new Set(rec.map((r) => r.sample)).size, features: new Set(rec.map((r) => r.feature)).size }
      }),
    [],
  )
  const fromUpload = draft?.source === 'upload'
  return (
    <>
      <h1 className="text-3xl font-extrabold">Create New Analysis</h1>
      <p className="sci mt-1 text-muted">Upload a prepared CSV abundance table or start from an illustrative sample dataset.</p>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card lift={false} className="p-6">
          <h2 className="text-lg font-bold">Option A — Upload your dataset</h2>
          <p className="sci mt-1 text-sm text-muted">Supported format: <b>.csv</b> with a header row, long format. Raw FASTQ sequencing files are not supported.</p>
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) readFile(f) }} className={`glow mt-4 rounded-2xl border-2 border-dashed p-8 text-center transition-all ${drag ? 'scale-[1.02] border-cyan bg-cyan/10' : 'border-line'}`}>
            <Upload className="mx-auto mb-3 text-cyan" size={34} />
            <p className="font-semibold">Drag and drop a CSV file here</p>
            <p className="mt-1 text-xs text-muted">or</p>
            <Btn variant="primary" className="mt-3" onClick={() => input.current?.click()}>Browse Files</Btn>
            <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = '' }} />
          </div>
          {prog !== null && (
            <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span className="flex items-center gap-1"><Loader2 size={13} className="animate-spin" /> Reading file…</span><span className="mono">{prog}%</span></div><div className="h-2 overflow-hidden rounded-full bg-line"><i className="block h-full rounded-full bg-gradient-to-r from-brand to-cyan transition-all" style={{ width: prog + '%' }} /></div></div>
          )}
          {err && <p role="alert" className="mt-4 flex gap-2 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad"><XCircle size={16} className="mt-0.5 shrink-0" />{err}</p>}
          {fromUpload && prog === null && draft && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-ok/40 bg-ok/10 p-3">
              <FileSpreadsheet className="text-ok" />
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{draft.fileName}</div><div className="mono text-xs text-muted">{bytes(draft.size)} · {draft.raw.rows.length.toLocaleString()} rows · {draft.raw.headers.length} columns</div></div>
              <Badge tone="ok">Loaded</Badge>
              <Btn size="sm" onClick={() => input.current?.click()}><RefreshCw size={13} /> Replace</Btn>
              <Btn size="sm" variant="danger" onClick={() => setDraft(null)}><Trash2 size={13} /> Remove</Btn>
            </div>
          )}
          {fromUpload && <Btn className="mt-3" size="sm" onClick={() => input.current?.click()}>Upload another dataset</Btn>}
        </Card>
        <Card lift={false} className="p-6">
          <h2 className="text-lg font-bold">Option B — Use a sample dataset</h2>
          <p className="sci mt-1 text-sm text-muted">All samples are <b>illustrative demo datasets</b> generated for this prototype, not real study data.</p>
          <div className="mt-4 space-y-3">
            {sampleStats.map(({ s, size, samples, features }) => (
              <div key={s.key} className={`glow rounded-xl border p-4 transition ${draft?.sampleKey === s.key ? 'border-cyan/60 bg-cyan/10' : 'border-line'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-bold">{s.name}</h3><Badge tone="violet">Demo</Badge></div>
                <p className="sci mt-1 text-xs text-muted">{s.description}</p>
                <div className="mono mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><span>{samples} samples</span><span>{features} features</span><span>{bytes(size)}</span></div>
                <p className="mt-1 text-xs text-faint">Groups: {s.groups.map((g) => `${g[0]} (${g[1]})`).join(', ')}</p>
                <div className="mt-3 flex gap-2"><Btn size="sm" onClick={() => setPrev(s.key)}><Eye size={13} /> Preview Sample</Btn><Btn size="sm" variant="primary" onClick={() => { loadSample(s.key); notify('upload', `Loaded demo dataset ${s.name}.`); go('/new/configure') }}>Use This Dataset</Btn></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Nav next={() => go('/new/configure')} disabled={!draft} note={!draft ? 'Choose a file or sample to continue' : undefined} />
      <Modal open={!!prev} onClose={() => setPrev(null)} title={`Preview — ${SAMPLES.find((s) => s.key === prev)?.name ?? ''} (demo)`} wide>
        {previewRaw && (
          <>
            <DataTable cols={previewRaw.headers.map((h, i) => ({ key: h, label: h, value: (r: string[]) => r[i], mono: true }))} rows={previewRaw.rows} pageSize={8} />
            <div className="mt-4 flex justify-end"><Btn variant="primary" onClick={() => { loadSample(prev!); setPrev(null); go('/new/configure') }}>Use This Dataset</Btn></div>
          </>
        )}
      </Modal>
    </>
  )
}

function Configure({ analysis }: { analysis: An }) {
  const { draft, setDraft, go } = useApp()
  if (!draft) return null
  const hs = draft.raw.headers
  const missing = FIELDS.filter((f) => f.required && !draft.mapping[f.key])
  const used = Object.values(draft.mapping)
  const dupCols = used.filter((h, i) => h && used.indexOf(h) !== i)
  const setMap = (k: Field, v: string) => setDraft({ mapping: { ...draft.mapping, [k]: v || undefined }, detected: false, maxStep: 1, reviewed: false })
  const mapped = FIELDS.filter((f) => draft.mapping[f.key])
  const sample = analysis.recs.slice(0, 8)
  const cellOf = (r: (typeof sample)[number], k: Field) => ({ sample_id: r.sample, feature_id: r.feature, organism: r.organism, taxonomic_rank: r.rank, abundance: r.abRaw, sample_group: r.group, lineage: r.lineage })[k]
  return (
    <>
      <h1 className="text-3xl font-extrabold">Configure columns</h1>
      <p className="sci mt-1 text-muted">Map the columns of <span className="mono">{draft.fileName}</span> to the fields Microbiome Atlas expects. {draft.detected && 'Suggested matches were found from header names - please confirm each one.'}</p>
      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <Card lift={false} className="p-5 lg:col-span-3">
          <div className="space-y-4">
            {FIELDS.map((f) => (
              <div key={f.key} className="grid gap-2 border-b border-line pb-4 last:border-0 last:pb-0 sm:grid-cols-2">
                <div><div className="flex items-center gap-2"><span className="mono text-sm font-semibold">{f.key}</span><Badge tone={f.required ? 'info' : 'mute'}>{f.required ? 'Required' : 'Optional'}</Badge></div><p className="sci mt-1 text-xs text-muted">{f.help}</p></div>
                <div>
                  <Select value={draft.mapping[f.key] ?? ''} onChange={(v) => setMap(f.key, v)} options={[{ value: '', label: f.required ? '— select column —' : '— not mapped —' }, ...hs.map((h) => ({ value: h, label: h }))]} />
                  {f.required && !draft.mapping[f.key] && <p className="mt-1 text-xs text-bad">Select a column for this required field.</p>}
                  {draft.mapping[f.key] && dupCols.includes(draft.mapping[f.key]!) && <p className="mt-1 text-xs text-warn">This column is mapped to more than one field.</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-5 lg:col-span-2">
          <Card lift={false} className="space-y-4 p-5">
            <F label="Dataset name"><input className="input" value={draft.name} onChange={(e) => setDraft({ name: e.target.value })} /></F>
            <F label="Description (optional)"><textarea className="input min-h-24" value={draft.description} onChange={(e) => setDraft({ description: e.target.value })} /></F>
          </Card>
          <Card lift={false} className="p-5"><h3 className="mb-3 font-bold">Mapped data preview</h3>
            {mapped.length ? (
              <div className="overflow-x-auto rounded-xl border border-line"><table className="tbl mono w-full text-xs"><thead><tr>{mapped.map((f) => <th key={f.key}>{f.key}</th>)}</tr></thead><tbody>{sample.map((r) => <tr key={r.row}>{mapped.map((f) => <td key={f.key} className="max-w-[140px] truncate">{cellOf(r, f.key) || <span className="text-faint">∅</span>}</td>)}</tr>)}</tbody></table></div>
            ) : <p className="text-sm text-muted">Map at least one column to preview.</p>}
          </Card>
        </div>
      </div>
      <Nav back={() => go('/new/upload')} next={() => { setDraft({ maxStep: Math.max(draft.maxStep, 2) }); go('/new/validate') }} disabled={missing.length > 0 || !draft.name.trim()} note={missing.length ? `Map required: ${missing.map((m) => m.key).join(', ')}` : !draft.name.trim() ? 'Enter a dataset name' : undefined} nextLabel="Continue to validation" />
    </>
  )
}

function Validate({ analysis }: { analysis: An }) {
  const { draft, setDraft, go, notify } = useApp()
  const [open, setOpen] = useState<string | null>(null)
  if (!draft) return null
  const errs = analysis.checks.filter((c) => c.status === 'error')
  const warns = analysis.checks.filter((c) => c.status === 'warn')
  const pass = analysis.checks.filter((c) => c.status === 'pass')
  const icon = (s: string) => (s === 'pass' ? <CheckCircle2 className="text-ok" size={20} /> : s === 'warn' ? <AlertTriangle className="text-warn" size={20} /> : <XCircle className="text-bad" size={20} />)
  const blocked = errs.length > 0 || (warns.length > 0 && !draft.reviewed)
  return (
    <>
      <h1 className="text-3xl font-extrabold">Validate dataset</h1>
      <p className="sci mt-1 text-muted">Your data is never changed silently. Rows with problems are reported here and excluded from calculations only as described.</p>
      <div className="stagger mt-6 grid gap-4 sm:grid-cols-3">
        {[['Passed', pass.length, 'text-ok'], ['Warnings', warns.length, 'text-warn'], ['Errors', errs.length, 'text-bad']].map(([l, v, c]) => <Card key={l as string} className="p-5"><div className="text-sm text-muted">{l}</div><div className={`mono text-3xl font-semibold ${c}`}>{v}</div></Card>)}
      </div>
      <div className="mt-5 space-y-3">
        {[...errs, ...warns, ...pass].map((c) => (
          <Card key={c.id} lift={false} className={`p-4 ${c.status === 'error' ? '!border-bad/50' : c.status === 'warn' ? '!border-warn/40' : ''}`}>
            <div className="flex items-start gap-3">
              {icon(c.status)}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{c.title}</h3>{c.count > 0 && <Badge tone={c.status === 'error' ? 'bad' : 'warn'}>{c.count} affected</Badge>}</div>
                <p className="sci mt-1 text-sm text-muted">{c.explanation}</p>
                {c.status !== 'pass' && <p className="sci mt-1 text-sm"><b>Recommended:</b> {c.action}</p>}
                {c.status !== 'pass' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.rows.length > 0 && <Btn size="sm" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide' : 'View'} affected rows</Btn>}
                    <Btn size="sm" onClick={() => go('/new/configure')}>Fix column mapping</Btn>
                  </div>
                )}
                {open === c.id && (
                  <div className="fade mt-3 max-h-64 overflow-auto rounded-xl border border-line"><table className="tbl mono w-full text-xs"><thead><tr><th>CSV row</th><th>sample_id</th><th>feature_id</th><th>abundance</th><th>group</th></tr></thead><tbody>{c.rows.slice(0, 50).map((n) => { const r = analysis.recs[n - 2]; return <tr key={n}><td>{n}</td><td>{r.sample || '∅'}</td><td>{r.feature || '∅'}</td><td>{r.abRaw || '∅'}</td><td>{r.group || '∅'}</td></tr> })}</tbody></table>{c.rows.length > 50 && <p className="p-2 text-xs text-muted">Showing first 50 of {c.rows.length}.</p>}</div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {errs.length === 0 && warns.length > 0 && (
        <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-line p-4 text-sm"><input type="checkbox" className="h-5 w-5 accent-cyan-400" checked={draft.reviewed} onChange={(e) => setDraft({ reviewed: e.target.checked })} /> I have reviewed the warnings and want to continue.</label>
      )}
      {errs.length > 0 && <p role="alert" className="mt-5 rounded-xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">Critical errors block progression. Return to configuration or fix the source file and upload it again.</p>}
      <Nav back={() => go('/new/configure')} next={() => { setDraft({ maxStep: Math.max(draft.maxStep, 3) }); notify('validation', `${draft.name}: validation passed with ${warns.length} warning(s).`); go('/new/preview') }} disabled={blocked} note={errs.length ? 'Resolve errors to continue' : blocked ? 'Confirm you reviewed the warnings' : undefined} nextLabel="Continue to preview" />
    </>
  )
}

function Preview({ analysis }: { analysis: An }) {
  const { draft, setDraft, go } = useApp()
  const [mode, setMode] = useState<'raw' | 'relative'>('relative')
  const [sample, setSample] = useState('all')
  const [group, setGroup] = useState('all')
  if (!draft) return null
  const { M, recs } = analysis
  const totals = new Map(M.samples.map((s, i) => [s, M.X[i].reduce((a, b) => a + b, 0)]))
  const groups = [...new Set(M.samples.map((s) => M.groupOf[s]))].sort()
  const rows = recs
    .filter((r) => (sample === 'all' || r.sample === sample) && (group === 'all' || (r.group || 'Ungrouped') === group))
    .map((r) => ({ ...r, rel: r.abundance !== null && r.abundance >= 0 && totals.get(r.sample) ? (r.abundance / totals.get(r.sample)!) * 100 : null }))
  return (
    <>
      <h1 className="text-3xl font-extrabold">Preview dataset</h1>
      <div className="stagger mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Samples', M.samples.length], ['Features', M.features.length], ['Groups', groups.length], ['Records', recs.length]].map(([l, v]) => <Card key={l as string} className="p-4"><div className="text-xs text-muted">{l}</div><div className="mono text-2xl font-semibold">{(v as number).toLocaleString()}</div></Card>)}
      </div>
      <Card lift={false} className="mt-5 p-5">
        <p className="sci mb-4 rounded-xl bg-brand/10 p-3 text-sm"><b>Relative Abundance (%)</b> = Feature Abundance / Total Abundance in Sample × 100. It describes proportions within a sample, not absolute organism abundance.</p>
        <DataTable
          rowKey={(r) => String(r.row)}
          initialSort={{ key: 'row', dir: 1 }}
          extra={<><Select value={sample} onChange={setSample} options={[{ value: 'all', label: 'All samples' }, ...M.samples.map((s) => ({ value: s, label: s }))]} className="!w-44" /><Select value={group} onChange={setGroup} options={[{ value: 'all', label: 'All groups' }, ...groups.map((s) => ({ value: s, label: s }))]} className="!w-40" /><Segmented value={mode} onChange={setMode} options={[{ value: 'raw', label: 'Raw' }, { value: 'relative', label: 'Relative %' }]} /></>}
          cols={[
            { key: 'row', label: 'Row', mono: true },
            { key: 'sample', label: 'Sample ID', mono: true },
            { key: 'feature', label: 'Feature ID', mono: true },
            { key: 'organism', label: 'Organism' },
            { key: 'rank', label: 'Rank' },
            mode === 'raw' ? { key: 'abundance', label: 'Raw abundance', mono: true, align: 'right' as const, value: (r) => r.abundance ?? '', render: (r) => r.abRaw || '∅' } : { key: 'rel', label: 'Relative abundance (%)', mono: true, align: 'right' as const, value: (r) => r.rel ?? -1, render: (r) => (r.rel === null ? '∅' : fmt(r.rel, 3)) },
            { key: 'group', label: 'Group' },
          ]}
          rows={rows}
        />
      </Card>
      <Nav back={() => go('/new/validate')} next={() => { setDraft({ maxStep: 4 }); go('/new/analysis') }} nextLabel="Continue to analysis selection" />
    </>
  )
}

function Analyse({ analysis }: { analysis: An }) {
  const { draft, setDraft, go, commit, runModules, notify, datasets } = useApp()
  const [run, setRun] = useState<{ i: number; id?: string } | null>(null)
  if (!draft) return null
  const mods = draft.modules
  const lineage = analysis.M.meta.some((m) => m.lineage)
  const toggle = (id: ModuleId) => setDraft({ modules: mods.includes(id) ? mods.filter((m) => m !== id) : [...mods, id] })
  const start = () => {
    const id = commit()
    if (!id) return notify('error', 'Dataset could not be loaded because validation has errors.')
    setRun({ i: 0, id })
    let i = 0
    const t = setInterval(() => {
      i++
      setRun({ i, id })
      if (i >= mods.length) {
        clearInterval(t)
        runModules(id, mods)
        notify('analysis', `Analysis completed for ${draft.name}: ${mods.length} module(s).`, id)
        setTimeout(() => { setDraft(null); go('/app/overview') }, 600)
      }
    }, 650)
  }
  void datasets
  return (
    <>
      <h1 className="text-3xl font-extrabold">Select analyses</h1>
      <p className="sci mt-1 text-muted">All selected modules are computed from your data in the browser. Modules marked experimental are descriptive only.</p>
      <div className="stagger mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => {
          const on = mods.includes(m.id)
          return (
            <Card key={m.id} onClick={() => !run && toggle(m.id)} className={`cursor-pointer p-5 ${on ? '!border-cyan/60' : ''}`}>
              <div className="flex items-start justify-between gap-2"><h3 className="font-bold">{m.label}</h3><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${on ? 'border-transparent bg-gradient-to-br from-brand to-cyan text-[#04101f]' : 'border-line'}`}>{on && <Check size={14} />}</span></div>
              <p className="sci mt-2 text-sm text-muted">{m.desc}</p>
              <div className="mt-3 flex flex-wrap gap-2"><Badge tone={m.status === 'Implemented' ? 'ok' : 'warn'}>{m.status}</Badge>{m.id === 'taxonomy' && !lineage && <Badge tone="warn">No lineage column</Badge>}</div>
            </Card>
          )
        })}
      </div>
      {run && (
        <Card lift={false} className="mt-5 p-5">
          <h3 className="mb-3 font-bold">Running analysis</h3>
          <ul className="space-y-2 text-sm">
            {mods.map((m, i) => <li key={m} className="flex items-center gap-2">{i < run.i ? <CheckCircle2 size={16} className="text-ok" /> : i === run.i ? <Loader2 size={16} className="animate-spin text-cyan" /> : <span className="h-4 w-4 rounded-full border border-line" />}<span className={i > run.i ? 'text-faint' : ''}>{MODULES.find((x) => x.id === m)!.label}</span></li>)}
          </ul>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-line"><i className="block h-full rounded-full bg-gradient-to-r from-brand to-cyan transition-all duration-500" style={{ width: (run.i / mods.length) * 100 + '%' }} /></div>
        </Card>
      )}
      <Nav back={() => go('/new/preview')} next={start} nextLabel="Run Analysis" disabled={!mods.length || !!run} note={!mods.length ? 'Select at least one analysis' : undefined} />
      <span hidden><Play /></span>
    </>
  )
}
