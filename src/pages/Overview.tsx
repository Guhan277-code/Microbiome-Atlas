import { useState } from 'react'
import { Database, FileText, FlaskConical, Layers, Rows3, Upload, Plus } from 'lucide-react'
import { MODULES, useApp } from '../store'
import { Bars, Donut, LineChart, StackedBars } from '../charts'
import { Badge, Btn, Card, DataTable, PageHeader, Select, Stat, ago, when } from '../ui'
import { ChartCard, Gate, compose, useData } from './common'
import { LEVELS, fmt, pct } from '../lib/science'

export default function Overview() {
  return (
    <Inner />
  )
}
function Inner() {
  const { datasets, reports, go, setActive, setDraft, draftFromDataset } = useApp()
  const { ds, M, d, levels, colorOf } = useData()
  const [lvl, setLvl] = useState<string>('')
  const level = (levels.includes(lvl as never) ? lvl : levels.includes('Phylum') ? 'Phylum' : levels[0] ?? 'Genus') as (typeof LEVELS)[number]
  const all = M.samples.map((_, i) => i)
  const comp = compose(M, level, 6, all)
  const myReports = reports.filter((r) => r.datasetId === ds.id)
  const order = [...M.samples.keys()].sort((a, b) => d.groups.indexOf(M.groupOf[M.samples[a]]) - d.groups.indexOf(M.groupOf[M.samples[b]]))
  const warns = ds.checks.filter((c) => c.status === 'warn')
  const meanRel = comp.names.map((_, j) => comp.rel.reduce((a, r) => a + r[j], 0) / Math.max(1, comp.rel.length))
  const topI = meanRel.findIndex((v, j) => comp.names[j] !== 'Other' && v === Math.max(...meanRel.filter((_, k) => comp.names[k] !== 'Other')))
  const alphaByGroup = d.groups.map((g) => { const v = d.alpha.filter((a) => a.group === g).map((a) => a.shannon); return { g, m: v.reduce((a, b) => a + b, 0) / v.length } })
  return (
    <div>
      <PageHeader title="Welcome to your Microbiome Workspace" desc="Explore your datasets, understand microbial communities, and discover meaningful patterns." badge={<Badge tone="info">Active: {ds.name}</Badge>} actions={<><Btn variant="primary" onClick={() => { setDraft(null); go('/new/upload') }}><Plus size={15} /> Create New Analysis</Btn><Btn onClick={() => { setDraft(null); go('/new/upload') }}><Upload size={15} /> Upload Dataset</Btn></>} />
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat icon={<Database size={20} />} label="Total Datasets (this session)" value={datasets.length} />
        <Stat icon={<FlaskConical size={20} />} label="Samples (active dataset)" value={M.samples.length} sub={M.zeroTotal.length ? `${M.zeroTotal.length} zero-total excluded` : undefined} />
        <Stat icon={<Layers size={20} />} label="Features (active dataset)" value={M.features.length} />
        <Stat icon={<Rows3 size={20} />} label="Completed Analyses (active)" value={Object.keys(ds.done).length} sub={`of ${MODULES.length} modules`} />
        <Stat icon={<FileText size={20} />} label="Generated Reports (active)" value={myReports.length} />
      </div>
      <div className="mt-5">
        {ds.runs.length === 0 ? (
          <Gate module="composition"><span /></Gate>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {ds.done.composition ? (
              <ChartCard title="Microbial Composition Overview" sub={`Mean relative abundance at ${level} level across all ${M.samples.length} samples`} right={<Select value={level} onChange={setLvl} options={levels as unknown as string[]} className="!w-36" />}>
                <Donut title={`Mean relative abundance by ${level}`} data={comp.names.map((n, j) => ({ label: n, value: meanRel[j] * 100, color: comp.colors[j] }))} unit="%" />
              </ChartCard>
            ) : <Card className="p-5 text-sm text-muted">Composition has not been run for this dataset.</Card>}
            {ds.done.alpha ? (
              <ChartCard title="Alpha Diversity Overview" sub="Shannon index (natural log) per sample, ordered by group">
                <LineChart title="Shannon index per sample" xLabel="Samples (grouped)" yLabel="Shannon index (H')" labels={order.map((i) => M.samples[i])} series={d.groups.map((g) => ({ name: g, color: colorOf(g), values: order.map((i) => (M.groupOf[M.samples[i]] === g ? d.alpha[i].shannon : null)) }))} />
              </ChartCard>
            ) : <Card className="p-5 text-sm text-muted">Alpha diversity has not been run for this dataset.</Card>}
            {ds.done.composition && (
              <>
                <ChartCard title="Taxonomic Distribution" sub={`Mean relative abundance of top ${level} taxa`}>
                  <Bars horizontal title={`Top ${level} taxa`} xLabel="Mean relative abundance (%)" yLabel={level} items={comp.names.map((n, j) => ({ label: n, value: meanRel[j] * 100, color: comp.colors[j] }))} fmtV={(v) => v.toFixed(1)} />
                </ChartCard>
                <ChartCard title="Sample Group Overview" sub={`Mean composition per group at ${level} level`}>
                  <StackedBars percent title="Group composition" xLabel="Sample group" yLabel="Mean relative abundance (%)" labels={d.groups} series={comp.names.map((n, j) => ({ name: n, color: comp.colors[j], values: d.groups.map((g) => { const ix = all.filter((i) => M.groupOf[M.samples[i]] === g); return ix.reduce((a, i) => a + comp.rel[i][j], 0) / Math.max(1, ix.length) }) }))} />
                </ChartCard>
              </>
            )}
          </div>
        )}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card lift={false} className="p-5"><h3 className="mb-3 font-bold">Recent Datasets</h3>
          <DataTable search={false} pageSize={5} rows={datasets} cols={[{ key: 'name', label: 'Name', render: (r) => <button className="font-semibold text-brand hover:underline" onClick={() => setActive(r.id)}>{r.name}</button>, value: (r) => r.name }, { key: 'id', label: 'ID', mono: true, value: (r) => r.id }, { key: 'm', label: 'Samples', mono: true, value: (r) => r.M.samples.length }, { key: 'u', label: 'Added', value: (r) => r.uploadedAt, render: (r) => ago(r.uploadedAt) }]} />
        </Card>
        <Card lift={false} className="p-5"><h3 className="mb-3 font-bold">Recent Analyses <span className="text-xs font-normal text-muted">(active dataset)</span></h3>
          {ds.runs.length ? <ul className="space-y-2.5 text-sm">{ds.runs.slice(0, 5).map((r) => <li key={r.id} className="flex items-start justify-between gap-3 border-b border-line pb-2 last:border-0"><span>{r.modules.map((m) => MODULES.find((x) => x.id === m)!.label).join(', ')}</span><span className="shrink-0 text-xs text-muted"><Badge tone="ok">Completed</Badge> {ago(r.at)}</span></li>)}</ul> : <p className="text-sm text-muted">No analyses yet.</p>}
          <Btn size="sm" className="mt-3" onClick={() => { draftFromDataset(ds.id); go('/new/analysis') }}>Run more analyses</Btn>
        </Card>
        <Card lift={false} className="p-5"><h3 className="mb-3 font-bold">Recent Reports <span className="text-xs font-normal text-muted">(active dataset)</span></h3>
          {myReports.length ? <ul className="space-y-2 text-sm">{myReports.slice(0, 5).map((r) => <li key={r.id} className="flex justify-between gap-3"><span className="truncate">{r.title}</span><span className="shrink-0 text-xs text-muted">{when(r.at)}</span></li>)}</ul> : <p className="text-sm text-muted">No reports generated yet.</p>}
          <Btn size="sm" className="mt-3" onClick={() => go('/app/reports')}>Open Reports</Btn>
        </Card>
        <Card lift={false} className="p-5"><h3 className="mb-3 font-bold">Key Observations</h3>
          <ul className="sci list-disc space-y-2 pl-5 text-sm">
            {ds.done.composition && topI >= 0 && <li>{comp.names[topI]} had the highest mean relative abundance at {level} level ({pct(meanRel[topI], 1)}).</li>}
            {ds.done.alpha && alphaByGroup.length > 1 && <li>Mean Shannon index by group: {alphaByGroup.map((a) => `${a.g} ${fmt(a.m, 2)}`).join(', ')}. This is descriptive; no significance test was performed, and higher diversity is not automatically better.</li>}
            <li>{M.usedRows.toLocaleString()} of {ds.recs.length.toLocaleString()} rows were used in calculations.</li>
            {warns.length > 0 && <li>{warns.length} validation warning(s) were accepted: {warns.map((w) => w.title).join('; ')}.</li>}
            {M.zeroTotal.length > 0 && <li>Excluded zero-total samples: {M.zeroTotal.join(', ')}.</li>}
          </ul>
        </Card>
      </div>
    </div>
  )
}
