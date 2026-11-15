import { useMemo } from 'react'
import { useApp } from '../store'
import { BoxPlot, Bars, Donut, Heatmap, PALETTE, StackedBars, Violin, Legend } from '../charts'
import { Card, DataTable, PageHeader } from '../ui'
import { ChartCard, Filters, Gate, Note, compose, useData } from './common'
import { LEVELS, aggregate, fmt } from '../lib/science'
export { Beta } from './Beta'

export function Composition() {
  return (
    <div>
      <PageHeader title="Composition Analysis" desc="Explore which taxa make up each community. Choose a taxonomic rank, filter by group or sample, and switch between raw and relative abundance." />
      <Gate module="composition"><CompInner /></Gate>
    </div>
  )
}
function CompInner() {
  const { filters } = useApp()
  const { M, d, levels, level, idxs, colorOf } = useData()
  const comp = useMemo(() => compose(M, level, filters.topN, idxs), [M, level, filters.topN, idxs])
  const rel = filters.mode === 'relative'
  const labels = idxs.map((i) => M.samples[i])
  if (!levels.length) return <Note tone="warn">No taxonomic level could be resolved. Map a lineage column or use ranks that match a standard level.</Note>
  if (!idxs.length) return <Note tone="warn">No samples match the current filters.</Note>
  const sumRaw = comp.names.map((_, j) => comp.raw.reduce((a, r) => a + r[j], 0))
  const meanRel = comp.names.map((_, j) => comp.rel.reduce((a, r) => a + r[j], 0) / comp.rel.length)
  const val = rel ? meanRel.map((v) => v * 100) : sumRaw
  const heat = comp.names.filter((n) => n !== 'Other')
  const rows = idxs.flatMap((i) => comp.A.names.map((n, j) => ({ organism: n, rank: level, raw: comp.A.X[i][j], rel: comp.R[i][j] * 100, sample: M.samples[i], group: M.groupOf[M.samples[i]] })).filter((r) => r.raw > 0))
  const perLevel = LEVELS.map((l) => ({ label: l, value: aggregate(M, l).names.filter((n) => n !== 'Unassigned').length }))
  return (
    <>
      <Filters show={['level', 'topN', 'group', 'sample', 'mode']} />
      {level !== filters.level && <div className="mb-4"><Note tone="warn">{filters.level} is not available for this dataset; showing {level} instead. Taxonomy is never guessed.</Note></div>}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title={`Composition donut (${level})`} sub={rel ? 'Mean relative abundance across selected samples' : 'Total raw abundance (reads) across selected samples'}>
          <Donut title={`Composition at ${level} level`} data={comp.names.map((n, j) => ({ label: n, value: val[j], color: comp.colors[j] }))} unit={rel ? '%' : ''} />
        </ChartCard>
        <ChartCard title="Relative abundance chart" sub={`Top ${filters.topN} ${level} taxa`}>
          <Bars horizontal title={`Top ${level} taxa`} xLabel={rel ? 'Mean relative abundance (%)' : 'Total raw abundance (reads)'} yLabel={level} items={comp.names.map((n, j) => ({ label: n, value: val[j], color: comp.colors[j] }))} fmtV={rel ? (v) => v.toFixed(1) : undefined} />
        </ChartCard>
      </div>
      <div className="mt-5">
        <ChartCard title="Stacked composition by sample" sub={rel ? 'Each bar sums to 100% of the sample total' : 'Raw abundance per sample (reads)'}>
          <StackedBars percent={rel} title="Stacked composition per sample" xLabel="Sample" yLabel={rel ? 'Relative abundance (%)' : 'Raw abundance (reads)'} labels={labels} series={comp.names.map((n, j) => ({ name: n, color: comp.colors[j], values: (rel ? comp.rel : comp.raw).map((r) => r[j]) }))} />
          <Legend items={d.groups.map((g) => ({ label: `Group: ${g}`, color: colorOf(g) }))} />
        </ChartCard>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Heatmap" sub={`${level} relative abundance (%) per sample`}>
          <Heatmap title="Relative abundance heatmap" rows={heat} cols={labels} values={heat.map((_, j) => comp.rel.map((r) => r[j] * 100))} xLabel="Sample" yLabel={level} legend="Relative abundance (%)" fmtV={(v) => v.toFixed(2) + '%'} />
        </ChartCard>
        <ChartCard title="Taxonomic distribution" sub="Number of distinct taxa resolved at each rank (whole dataset)">
          <Bars title="Distinct taxa per rank" xLabel="Taxonomic rank" yLabel="Distinct taxa" items={perLevel.map((p, i) => ({ ...p, color: PALETTE[i] }))} />
        </ChartCard>
      </div>
      <Card lift={false} className="mt-5 p-5">
        <h3 className="mb-3 font-bold">Taxonomic table</h3>
        <DataTable
          rows={rows}
          rowKey={(r, i) => r.sample + r.organism + i}
          initialSort={{ key: filters.mode === 'raw' ? 'raw' : 'rel', dir: -1 }}
          cols={[
            { key: 'organism', label: 'Organism' },
            { key: 'rank', label: 'Taxonomic rank' },
            { key: 'raw', label: 'Raw abundance', mono: true, align: 'right', render: (r) => r.raw.toLocaleString() },
            { key: 'rel', label: 'Relative abundance (%)', mono: true, align: 'right', render: (r) => fmt(r.rel, 3) },
            { key: 'sample', label: 'Sample', mono: true },
            { key: 'group', label: 'Group' },
          ]}
        />
      </Card>
    </>
  )
}

const METRICS = {
  observed: { label: 'Observed Features', desc: 'Number of features with abundance above zero in a sample. Simple richness; sensitive to sequencing depth.' },
  shannon: { label: 'Shannon Index (H′)', desc: 'H′ = −Σ pᵢ ln pᵢ using natural log. Increases with more features and more even abundances.' },
  simpson: { label: 'Simpson Index (1 − D)', desc: 'Gini–Simpson form: 1 − D where D = Σ pᵢ². This is the probability that two randomly drawn reads belong to different features. D alone (Σ pᵢ²) is the complement and is not shown.' },
  pielou: { label: "Pielou's Evenness (J′)", desc: 'J′ = H′ / ln(S) where S is observed features. Ranges 0 to 1; closer to 1 means abundances are more evenly spread. Undefined (n/a) when S = 1.' },
} as const

export function Alpha() {
  return (
    <div>
      <PageHeader title="Alpha Diversity" desc="Within-sample diversity: how many features a community contains and how evenly they are distributed." />
      <Gate module="alpha"><AlphaInner /></Gate>
    </div>
  )
}
function AlphaInner() {
  const { filters } = useApp()
  const { d, M, idxs, colorOf } = useData()
  const metric = filters.metric
  const rows = idxs.map((i) => d.alpha[i])
  const groups = [...new Set(rows.map((r) => r.group))].sort()
  const get = (r: (typeof rows)[number]) => r[metric]
  const gs = groups.map((g) => ({ name: g, color: colorOf(g), values: rows.filter((r) => r.group === g && get(r) !== null).map((r) => get(r) as number) }))
  const label = METRICS[metric].label
  if (!rows.length) return <Note tone="warn">No samples match the current filters.</Note>
  return (
    <>
      <Filters show={['metric', 'group', 'sample']} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title={`Box plot: ${label}`} sub="Box = quartiles, line = median, points = samples"><BoxPlot title={`${label} box plot`} groups={gs} yLabel={label} /></ChartCard>
        <ChartCard title={`Violin plot: ${label}`} sub="Gaussian kernel density; interpret cautiously with few samples"><Violin title={`${label} violin plot`} groups={gs} yLabel={label} /></ChartCard>
      </div>
      <div className="mt-5">
        <ChartCard title={`Per-sample ${label}`}>
          <Bars title={`${label} per sample`} xLabel="Sample" yLabel={label} items={rows.filter((r) => get(r) !== null).map((r) => ({ label: r.sample, value: get(r) as number, color: colorOf(r.group) }))} fmtV={(v) => fmt(v, 2)} />
          <Legend items={d.groups.map((g) => ({ label: g, color: colorOf(g) }))} />
        </ChartCard>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card lift={false} className="p-5">
          <h3 className="mb-3 font-bold">Metric descriptions</h3>
          <dl className="space-y-3 text-sm">{(Object.keys(METRICS) as (keyof typeof METRICS)[]).map((k) => <div key={k}><dt className="font-semibold">{METRICS[k].label}</dt><dd className="sci text-muted">{METRICS[k].desc}</dd></div>)}</dl>
        </Card>
        <Card lift={false} className="p-5">
          <h3 className="mb-3 font-bold">Interpretation</h3>
          <ul className="sci list-disc space-y-2 pl-5 text-sm">
            {gs.map((g) => <li key={g.name}>{g.name}: mean {label} = <b className="mono">{fmt(g.values.length ? g.values.reduce((a, b) => a + b, 0) / g.values.length : null, 3)}</b> (n = {g.values.length}).</li>)}
            <li>These are descriptive summaries. No statistical test was run, so no group difference is claimed.</li>
            <li>Greater diversity does <b>not</b> automatically mean a healthier or better microbiome; interpretation depends on the habitat and study design.</li>
            <li>Counts are not rarefied, so observed features and Shannon can be influenced by sequencing depth.</li>
            <li>Zero-total samples {M.zeroTotal.length ? `(${M.zeroTotal.join(', ')}) were excluded.` : 'were not present.'}</li>
          </ul>
        </Card>
      </div>
      <Card lift={false} className="mt-5 p-5">
        <h3 className="mb-3 font-bold">Results table</h3>
        <DataTable
          rows={rows}
          rowKey={(r) => r.sample}
          cols={[
            { key: 'sample', label: 'Sample', mono: true },
            { key: 'group', label: 'Group' },
            { key: 'observed', label: 'Observed', mono: true, align: 'right' },
            { key: 'shannon', label: 'Shannon', mono: true, align: 'right', render: (r) => fmt(r.shannon, 4) },
            { key: 'simpson', label: 'Simpson (1−D)', mono: true, align: 'right', render: (r) => fmt(r.simpson, 4) },
            { key: 'pielou', label: 'Pielou', mono: true, align: 'right', value: (r) => r.pielou ?? -1, render: (r) => fmt(r.pielou, 4) },
          ]}
        />
      </Card>
    </>
  )
}
