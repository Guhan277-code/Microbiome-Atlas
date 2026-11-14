import { useState } from 'react'
import { AlertCircle, BarChart3, CheckCircle2, Download, FileText, ShieldCheck, Upload, Info, Trash2 } from 'lucide-react'
import { useApp } from '../store'
import { Badge, Btn, Card, Empty, Field, PageHeader, Segmented, Select, Tabs, Toggle, ago, download } from '../ui'
import { TEMPLATE_CSV } from '../lib/samples'
import { LEVELS } from '../lib/science'
import { Note } from './common'

const ICON = { upload: Upload, validation: ShieldCheck, analysis: BarChart3, report: FileText, error: AlertCircle, info: Info }
const TONE = { upload: 'info', validation: 'ok', analysis: 'violet', report: 'ok', error: 'bad', info: 'mute' } as const

export function Activity() {
  const { notes, markRead, clearNotes, datasets } = useApp()
  const [f, setF] = useState('all')
  const list = notes.filter((n) => f === 'all' || n.kind === f)
  return (
    <div>
      <PageHeader title="Activity" desc="Events recorded in this browser session: uploads, validation, analyses, reports and errors. Nothing is stored permanently." actions={<><Btn size="sm" onClick={markRead}><CheckCircle2 size={14} /> Mark all read</Btn><Btn size="sm" variant="danger" onClick={clearNotes} disabled={!notes.length}><Trash2 size={14} /> Clear</Btn></>} />
      <div className="mb-4 max-w-xs"><Select value={f} onChange={setF} options={[{ value: 'all', label: 'All events' }, { value: 'upload', label: 'Uploads' }, { value: 'validation', label: 'Validation' }, { value: 'analysis', label: 'Analyses' }, { value: 'report', label: 'Reports' }, { value: 'error', label: 'Errors' }, { value: 'info', label: 'Other' }]} /></div>
      {list.length ? (
        <div className="stagger space-y-3">
          {list.map((n) => {
            const I = ICON[n.kind]
            return <Card key={n.id} className="flex items-start gap-3 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-cyan"><I size={17} /></span><div className="min-w-0 flex-1"><p className="text-sm">{n.text}</p><p className="mt-1 text-xs text-muted">{ago(n.t)}{n.datasetId && ` · ${datasets.find((d) => d.id === n.datasetId)?.name ?? n.datasetId}`}</p></div><Badge tone={TONE[n.kind]}>{n.kind}</Badge></Card>
          })}
        </div>
      ) : <Empty icon={<Info size={26} />} title="No activity yet" text="Events will appear here as you upload data, validate, run analyses and generate reports." />}
    </div>
  )
}

const DOCS: { id: string; title: string; body: React.ReactNode }[] = [
  { id: 'start', title: 'Getting Started', body: <><p>Microbiome Atlas analyses <b>prepared abundance tables</b> in CSV format. The workflow is: upload (or pick a demo sample), map columns, validate, preview, choose analyses, then explore, compare and report.</p><p>You cannot open the workspace until a dataset has been loaded and validated. Datasets live in this browser session only.</p></> },
  { id: 'format', title: 'Supported CSV Format', body: <><p>Long format, one row per sample-feature pair, with a header row. Required fields: <code>sample_id</code>, <code>feature_id</code>, <code>organism</code>, <code>taxonomic_rank</code>, <code>abundance</code>, <code>sample_group</code>. Optional: <code>lineage</code> (semicolon-separated Kingdom to Species).</p><p>Column names can differ; you map them in the configuration step. Raw FASTQ files and wide matrices are not supported.</p></> },
  { id: 'template', title: 'CSV Template', body: <><pre className="mono overflow-x-auto rounded-xl border border-line bg-[var(--solid)] p-3 text-xs">{TEMPLATE_CSV}</pre><Btn size="sm" className="mt-3" onClick={() => download('microbiome-atlas-template.csv', TEMPLATE_CSV)}><Download size={14} /> Download template</Btn></> },
  { id: 'upload', title: 'Uploading Data', body: <p>Drag a .csv file onto the upload area or use Browse Files. The file is read locally in your browser and is not sent anywhere. You can replace or remove the file before continuing.</p> },
  { id: 'config', title: 'Configuring Columns', body: <p>Select the CSV column for every required field. Suggestions based on header names are shown but never applied silently: confirm each one. A column used for two fields triggers a warning.</p> },
  { id: 'validate', title: 'Validating Datasets', body: <p>Twelve checks cover missing columns and values, non-numeric and negative abundances, duplicates, zero-total samples and unusual values. Errors (such as negative values) block progression. Warnings can be accepted after review. Data is never changed silently.</p> },
  { id: 'rel', title: 'Understanding Relative Abundance', body: <><p><b>Relative Abundance (%) = Feature Abundance / Total Abundance in Sample x 100.</b></p><p>It expresses composition within a sample. It is not absolute abundance: if one taxon grows, the others shrink in relative terms even if their counts did not change.</p></> },
  { id: 'alpha', title: 'Understanding Alpha Diversity', body: <><p>Alpha diversity summarises one sample. Observed features counts features above zero; Shannon H = -sum(p ln p); Simpson is reported as <b>1 - D</b> with D = sum(p^2); Pielou evenness = H / ln(S).</p><p>Higher diversity is not automatically healthier or better.</p></> },
  { id: 'beta', title: 'Understanding Beta Diversity', body: <p>Beta diversity compares samples. Bray-Curtis dissimilarity ranges from 0 (identical) to 1 (nothing shared). PCoA is an ordination method that projects the distance matrix to two axes; it is not a diversity index. NMDS is not implemented.</p> },
  { id: 'reports', title: 'Generating Reports', body: <p>Choose a report type, adjust sections and generate. Export is supported as PDF (via the browser print dialog), CSV (tables), and SVG or PNG (single chart). Reports contain only computed results, methods and limitations.</p> },
  { id: 'faq', title: 'FAQ', body: <><p><b>Are results saved?</b> No. Reloading clears datasets; only the theme preference is remembered.</p><p><b>Is sign-in real?</b> No, it is a prototype.</p><p><b>Can it diagnose?</b> No.</p></> },
]
export function Docs() {
  const [id, setId] = useState('start')
  const doc = DOCS.find((d) => d.id === id)!
  return (
    <div>
      <PageHeader title="Documentation" desc="How Microbiome Atlas works, what it supports, and how to read its results." />
      <div className="grid gap-5 lg:grid-cols-4">
        <Card lift={false} className="p-2 lg:col-span-1"><nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Documentation">{DOCS.map((d) => <button key={d.id} onClick={() => setId(d.id)} aria-current={id === d.id} className={`shrink-0 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${id === d.id ? 'bg-brand/15 text-ink' : 'text-muted hover:text-ink'}`}>{d.title}</button>)}</nav></Card>
        <Card lift={false} className="lg:col-span-3"><article key={id} className="sci page-in space-y-3 p-6 text-sm leading-relaxed text-muted [&_b]:text-ink [&_code]:mono [&_code]:rounded [&_code]:bg-brand/10 [&_code]:px-1"><h2 className="font-sans text-xl font-bold text-ink">{doc.title}</h2>{doc.body}</article></Card>
      </div>
    </div>
  )
}

const TABS = [{ id: 'profile', label: 'Profile' }, { id: 'appearance', label: 'Appearance' }, { id: 'analysis', label: 'Analysis Preferences' }, { id: 'notifications', label: 'Notifications' }, { id: 'data', label: 'Data Preferences' }, { id: 'export', label: 'Export Preferences' }] as const
export function Settings() {
  const { settings, setSettings, theme, setTheme, user } = useApp()
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('profile')
  const Row = ({ t, d, children }: { t: string; d?: string; children: React.ReactNode }) => <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4 last:border-0"><div className="max-w-md"><div className="text-sm font-semibold">{t}</div>{d && <div className="sci text-xs text-muted">{d}</div>}</div>{children}</div>
  return (
    <div>
      <PageHeader title="Settings" desc="Preferences apply to this browser session. Only the theme is remembered between visits." />
      <Tabs value={tab} onChange={setTab} tabs={TABS as unknown as { id: typeof tab; label: string }[]} />
      <Card lift={false} className="mt-3 p-6"><div key={tab} className="page-in">
        {tab === 'profile' && <div className="grid max-w-xl gap-4"><Note>Prototype profile: details stay in this session and are not sent anywhere.{user?.guest ? ' You are using a guest session.' : ''}</Note><Field label="Display name"><input className="input" value={settings.name} onChange={(e) => setSettings({ name: e.target.value })} /></Field><Field label="Email"><input className="input" value={settings.email} onChange={(e) => setSettings({ email: e.target.value })} inputMode="email" /></Field></div>}
        {tab === 'appearance' && <><Row t="Theme" d="Dark or light. Remembered in this browser."><Segmented value={theme} onChange={setTheme} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} /></Row><Row t="Reduce motion" d="Disables animations and transitions. Also follows your system preference."><Toggle label="Reduce motion" checked={settings.reduceMotion} onChange={(v) => setSettings({ reduceMotion: v })} /></Row></>}
        {tab === 'analysis' && <><Row t="Default taxonomic rank" d="Used when opening Composition and comparison views."><div className="w-40"><Select value={settings.level} onChange={(v) => setSettings({ level: v })} options={[...LEVELS]} /></div></Row><Row t="Default Top-N" d="Number of taxa shown before grouping the rest as Other."><div className="w-28"><Select value={String(settings.topN)} onChange={(v) => setSettings({ topN: +v })} options={['5', '8', '10', '15', '20']} /></div></Row><Row t="Simpson formulation" d="Fixed to 1 - D (Gini-Simpson, D = sum of squared proportions)."><Badge tone="info">1 - D</Badge></Row></>}
        {tab === 'notifications' && <><Row t="Show pop-up notifications" d="Brief toasts for events; all events still appear in Activity."><Toggle label="Pop-up notifications" checked={settings.toasts} onChange={(v) => setSettings({ toasts: v })} /></Row>{Object.keys(settings.notifyKinds).map((k) => <Row key={k} t={`${k[0].toUpperCase()}${k.slice(1)} events`}><Toggle label={k} checked={settings.notifyKinds[k]} onChange={(v) => setSettings({ notifyKinds: { ...settings.notifyKinds, [k]: v } })} /></Row>)}</>}
        {tab === 'data' && <><Row t="Default abundance view" d="Raw counts or relative abundance in tables and charts."><Segmented value={settings.mode} onChange={(v) => setSettings({ mode: v })} options={[{ value: 'relative', label: 'Relative %' }, { value: 'raw', label: 'Raw' }]} /></Row><Row t="Storage" d="Datasets are held in memory for this session only and are never uploaded."><Badge tone="warn">Session only</Badge></Row></>}
        {tab === 'export' && <><Row t="Default export format"><div className="w-44"><Select value={settings.exportFormat} onChange={(v) => setSettings({ exportFormat: v as never })} options={[{ value: 'pdf', label: 'PDF (print)' }, { value: 'csv', label: 'CSV' }, { value: 'svg', label: 'SVG' }, { value: 'png', label: 'PNG' }]} /></div></Row><Row t="File name prefix" d="Used for exported files."><input className="input w-56" value={settings.prefix} onChange={(e) => setSettings({ prefix: e.target.value.replace(/[^\w-]/g, '') })} /></Row></>}
      </div></Card>
    </div>
  )
}
