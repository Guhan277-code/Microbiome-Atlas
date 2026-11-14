import { Fragment, useState } from 'react'
import { BarChart3, Download, Eye, FolderOpen, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { MODULES, useApp, type Dataset } from '../store'
import { Badge, Btn, Card, DataTable, Modal, PageHeader, Select, ago, download, when } from '../ui'
import { bytes, toCSV } from '../lib/science'

const aStatus = (d: Dataset) => (Object.keys(d.done).length === 0 ? 'Not analysed' : Object.keys(d.done).length === MODULES.length ? 'Complete' : 'Partial')

export default function Datasets() {
  const { datasets, active, setActive, go, draftFromDataset, rename, remove, setDraft, notify } = useApp()
  const [type, setType] = useState('all')
  const [st, setSt] = useState('all')
  const [prev, setPrev] = useState<Dataset | null>(null)
  const [ren, setRen] = useState<Dataset | null>(null)
  const [name, setName] = useState('')
  const [del, setDel] = useState<Dataset | null>(null)
  const [sel, setSel] = useState<string>(active?.id ?? '')
  const rows = datasets.filter((d) => (type === 'all' || d.type === type) && (st === 'all' || aStatus(d) === st))
  const detail = datasets.find((d) => d.id === sel) ?? active
  const dl = (d: Dataset) => {
    download(`${d.name.replace(/\W+/g, '_')}.csv`, toCSV(d.raw.headers, d.raw.rows))
    notify('info', `Downloaded original CSV for ${d.name}.`)
  }
  return (
    <div>
      <PageHeader title="Datasets" desc="Manage every dataset loaded in this session. Each dataset keeps its own results and history." actions={<><Btn variant="primary" onClick={() => { setDraft(null); go('/new/upload') }}><Upload size={15} /> Upload New Dataset</Btn><Btn onClick={() => { setDraft(null); go('/new/upload') }}><Plus size={15} /> Use Sample Dataset</Btn></>} />
      <Card lift={false} className="p-5">
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          extra={<><Select value={type} onChange={setType} options={[{ value: 'all', label: 'All types' }, 'Upload', 'Sample']} className="!w-36" /><Select value={st} onChange={setSt} options={[{ value: 'all', label: 'All analysis states' }, 'Not analysed', 'Partial', 'Complete']} className="!w-48" /></>}
          cols={[
            { key: 'name', label: 'Dataset', value: (r) => r.name, render: (r) => <button className="text-left font-semibold hover:text-brand" onClick={() => setSel(r.id)}>{r.name}{r.id === active?.id && <span className="ml-2 text-[0.65rem] text-cyan">ACTIVE</span>}</button> },
            { key: 'id', label: 'ID', mono: true, value: (r) => r.id },
            { key: 'type', label: 'Type', value: (r) => r.type, render: (r) => <Badge tone={r.type === 'Sample' ? 'violet' : 'info'}>{r.type === 'Sample' ? 'Demo sample' : 'Upload'}</Badge> },
            { key: 'samples', label: 'Samples', mono: true, value: (r) => r.M.samples.length },
            { key: 'features', label: 'Features', mono: true, value: (r) => r.M.features.length },
            { key: 'date', label: 'Added', value: (r) => r.uploadedAt, render: (r) => when(r.uploadedAt) },
            { key: 'val', label: 'Validation', value: (r) => r.checks.filter((c) => c.status === 'warn').length, render: (r) => { const w = r.checks.filter((c) => c.status === 'warn').length; return <Badge tone={w ? 'warn' : 'ok'}>{w ? `${w} warning${w > 1 ? 's' : ''}` : 'Valid'}</Badge> } },
            { key: 'an', label: 'Analysis', value: aStatus, render: (r) => <Badge tone={aStatus(r) === 'Complete' ? 'ok' : aStatus(r) === 'Partial' ? 'info' : 'mute'}>{aStatus(r)}</Badge> },
            { key: 'act', label: 'Actions', value: () => '', render: (r) => (
              <div className="flex gap-1">
                <Btn size="icon" className="!h-8 !min-h-8 !w-8" title="Open" aria-label={`Open ${r.name}`} onClick={() => { setActive(r.id); go('/app/overview') }}><FolderOpen size={14} /></Btn>
                <Btn size="icon" className="!h-8 !min-h-8 !w-8" title="Preview" aria-label="Preview" onClick={() => setPrev(r)}><Eye size={14} /></Btn>
                <Btn size="icon" className="!h-8 !min-h-8 !w-8" title="Analyse" aria-label="Analyse" onClick={() => { setActive(r.id); draftFromDataset(r.id); go('/new/analysis') }}><BarChart3 size={14} /></Btn>
                <Btn size="icon" className="!h-8 !min-h-8 !w-8" title="Rename" aria-label="Rename" onClick={() => { setRen(r); setName(r.name) }}><Pencil size={14} /></Btn>
                <Btn size="icon" className="!h-8 !min-h-8 !w-8" title="Download" aria-label="Download" onClick={() => dl(r)}><Download size={14} /></Btn>
                <Btn size="icon" variant="danger" className="!h-8 !min-h-8 !w-8" title="Delete" aria-label="Delete" onClick={() => setDel(r)}><Trash2 size={14} /></Btn>
              </div>
            ) },
          ]}
        />
      </Card>
      {detail && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card lift={false} className="p-5">
            <h3 className="mb-3 font-bold">Dataset details</h3>
            <dl className="sci grid grid-cols-[130px_1fr] gap-y-2 text-sm">
              {[['Name', detail.name], ['ID', detail.id], ['File', detail.fileName], ['Size', bytes(detail.size)], ['Rows', detail.recs.length.toLocaleString()], ['Samples / features', `${detail.M.samples.length} / ${detail.M.features.length}`], ['Description', detail.description || '—']].map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd className="mono break-words text-[0.82rem]">{v}</dd></Fragment>)}
            </dl>
            <p className="mt-3 text-xs text-faint">Kept in this browser session only; reloading the page clears all datasets.</p>
          </Card>
          <Card lift={false} className="p-5">
            <h3 className="mb-3 font-bold">Dataset history</h3>
            <ul className="space-y-2 text-sm">{detail.history.map((h, i) => <li key={i} className="flex justify-between gap-3 border-b border-line pb-2 last:border-0"><span>{h.text}</span><span className="shrink-0 text-xs text-muted">{ago(h.t)}</span></li>)}</ul>
          </Card>
        </div>
      )}
      <Modal wide open={!!prev} onClose={() => setPrev(null)} title={`Preview — ${prev?.name ?? ''}`}>
        {prev && <DataTable pageSize={8} rows={prev.raw.rows} cols={prev.raw.headers.map((h, i) => ({ key: h, label: h, mono: true, value: (r: string[]) => r[i] }))} />}
      </Modal>
      <Modal open={!!ren} onClose={() => setRen(null)} title="Rename dataset">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Dataset name" autoFocus />
        <div className="mt-4 flex justify-end gap-2"><Btn onClick={() => setRen(null)}>Cancel</Btn><Btn variant="primary" disabled={!name.trim()} onClick={() => { rename(ren!.id, name.trim()); setRen(null) }}>Save</Btn></div>
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete dataset?">
        <p className="sci text-sm text-muted">This permanently removes <b>{del?.name}</b>, its analysis results and its reports from this session. This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2"><Btn onClick={() => setDel(null)}>Cancel</Btn><Btn variant="danger" onClick={() => { notify('info', `Deleted ${del!.name}.`); remove(del!.id); setDel(null) }}><Trash2 size={14} /> Delete</Btn></div>
      </Modal>
    </div>
  )
}
