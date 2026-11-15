import { useMemo } from 'react'
import { useApp } from '../store'
import { Heatmap, Scatter } from '../charts'
import { Card, DataTable, PageHeader } from '../ui'
import { ChartCard, Filters, Gate, Note, useData } from './common'
import { MAX_PCOA_SAMPLES, fmt, pcoa } from '../lib/science'

export function Beta() {
  return (
    <div>
      <PageHeader title="Beta Diversity" desc="Between-sample diversity describes how different communities are in composition. Computed here with Bray-Curtis dissimilarity on relative abundances." />
      <Gate module="beta"><BetaInner /></Gate>
    </div>
  )
}
function BetaInner() {
  const { d, M, colorOf } = useData()
  const { filters } = useApp()
  const ix = M.samples
    .map((_, i) => i)
    .filter((i) => filters.group === 'all' || M.groupOf[M.samples[i]] === filters.group)
    .sort((a, b) => d.groups.indexOf(M.groupOf[M.samples[a]]) - d.groups.indexOf(M.groupOf[M.samples[b]]))
  const D = useMemo(() => ix.map((i) => ix.map((j) => d.D[i][j])), [ix.join(','), d])
  const pc = useMemo(() => pcoa(D), [D])
  const names = ix.map((i) => M.samples[i])
  const within: Record<string, number[]> = {}
  const between: Record<string, number[]> = {}
  ix.forEach((a, p) =>
    ix.forEach((b, q) => {
      if (q <= p) return
      const ga = M.groupOf[M.samples[a]]
      const gb = M.groupOf[M.samples[b]]
      if (ga === gb) (within[ga] ??= []).push(d.D[a][b])
      else (between[[ga, gb].sort().join(' vs ')] ??= []).push(d.D[a][b])
    }),
  )
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const summary = [...Object.entries(within).map(([k, v]) => ({ k: `Within ${k}`, n: v.length, m: mean(v) })), ...Object.entries(between).map(([k, v]) => ({ k: `Between ${k}`, n: v.length, m: mean(v) }))]
  if (ix.length < 2) return <Note tone="warn">At least two samples are needed for beta diversity.</Note>
  return (
    <>
      <Filters show={['group']} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Bray-Curtis distance matrix" sub="0 = identical composition, 1 = no shared features">
          <Heatmap title="Bray-Curtis dissimilarity heatmap" rows={names} cols={names} values={D} xLabel="Sample" yLabel="Sample" legend="Bray-Curtis" domain={[0, 1]} minCell={16} />
        </ChartCard>
        <ChartCard title="PCoA ordination" sub="Principal Coordinates Analysis of the Bray-Curtis matrix">
          {pc ? (
            <Scatter title="PCoA of Bray-Curtis dissimilarity" xLabel={`PCoA 1 (${(pc.explained[0] * 100).toFixed(1)}% of positive eigenvalue sum)`} yLabel={`PCoA 2 (${(pc.explained[1] * 100).toFixed(1)}%)`} points={ix.map((i, k) => ({ x: pc.coords[k][0], y: pc.coords[k][1], label: M.samples[i], group: M.groupOf[M.samples[i]], color: colorOf(M.groupOf[M.samples[i]]) }))} legend={d.groups.map((g) => ({ label: g, color: colorOf(g) }))} />
          ) : (
            <Note tone="warn">
              {ix.length > MAX_PCOA_SAMPLES
                ? `PCoA ordination is capped at ${MAX_PCOA_SAMPLES} samples in the browser (currently ${ix.length} selected) to keep Jacobi decomposition responsive. Use the group filter or inspect the pairwise Bray-Curtis heatmap.`
                : 'PCoA needs at least three samples with non-degenerate distances and at least two positive eigenvalues. No coordinates are shown.'}
            </Note>
          )}
        </ChartCard>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card lift={false} className="p-5">
          <h3 className="mb-3 font-bold">Mean pairwise dissimilarity</h3>
          <DataTable search={false} pageSize={8} rows={summary} cols={[{ key: 'k', label: 'Comparison' }, { key: 'n', label: 'Pairs', mono: true, align: 'right' }, { key: 'm', label: 'Mean Bray-Curtis', mono: true, align: 'right', render: (r) => fmt(r.m, 4) }]} />
          <p className="sci mt-3 text-xs text-muted">Descriptive averages only. No PERMANOVA or p-value was computed.</p>
        </Card>
        <Card lift={false} className="p-5">
          <h3 className="mb-3 font-bold">Methodology</h3>
          <ul className="sci list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Bray-Curtis = Σ|pᵢₖ − pⱼₖ| / Σ(pᵢₖ + pⱼₖ), calculated on per-sample relative abundances.</li>
            <li>PCoA is an ordination method, not a diversity index. Axis signs are arbitrary. Explained variation = eigenvalue / sum of positive eigenvalues, both calculated from this matrix.</li>
            <li>NMDS is not implemented, so no NMDS stress is shown.</li>
            <li>A 2-D plot approximates, but does not equal, the full dissimilarity.</li>
            <li>Missing values were not treated as zero; samples with zero total were excluded{M.zeroTotal.length ? ` (${M.zeroTotal.join(', ')})` : ''}.</li>
          </ul>
        </Card>
      </div>
    </>
  )
}
