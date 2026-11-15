import { useMemo, useState, type ReactNode } from 'react'
import { FlaskConical, Play } from 'lucide-react'
import { MODULES, useApp, type ModuleId } from '../store'
import { LEVELS, aggregate, availableLevels, derive, relMatrix, type Matrix } from '../lib/science'
import { groupColor, OTHER, PALETTE } from '../charts'
import { Btn, Card, ChipSelect, Empty, Select, Segmented } from '../ui'

export function useData() {
  const { active, filters } = useApp()
  const M = active!.M
  const d = useMemo(() => derive(M), [M])
  const levels = useMemo(() => availableLevels(M), [M])
  const level = (levels.includes(filters.level as never) ? filters.level : levels.includes('Genus') ? 'Genus' : levels[0] ?? 'Genus') as (typeof LEVELS)[number]
  const idxs = M.samples.map((_, i) => i).filter((i) => (filters.group === 'all' || M.groupOf[M.samples[i]] === filters.group) && (filters.sample === 'all' || M.samples[i] === filters.sample))
  const colorOf = (g: string) => groupColor(d.groups, g)
  return { ds: active!, M, d, levels, level, idxs, colorOf, filters }
}

export function compose(M: Matrix, level: (typeof LEVELS)[number], topN: number, idxs: number[]) {
  const A = aggregate(M, level)
  const R = relMatrix(A.X)
  const mean = A.names.map((_, j) => idxs.reduce((a, i) => a + R[i][j], 0) / Math.max(1, idxs.length))
  const order = A.names.map((_, j) => j).sort((a, b) => mean[b] - mean[a])
  const top = order.slice(0, topN)
  const rest = order.slice(topN)
  const names = [...top.map((j) => A.names[j]), ...(rest.length ? ['Other'] : [])]
  const colors = names.map((n, i) => (n === 'Other' ? OTHER : PALETTE[i % PALETTE.length]))
  const mk = (S: number[][]) => idxs.map((i) => [...top.map((j) => S[i][j]), ...(rest.length ? [rest.reduce((a, j) => a + S[i][j], 0)] : [])])
  return { names, colors, raw: mk(A.X), rel: mk(R), mean: top.map((j) => mean[j]), A, R, order, idxs }
}

export function Gate({ module, children }: { module: ModuleId | 'any'; children: ReactNode }) {
  const { active, draftFromDataset, go, runModules, notify } = useApp()
  const [running, setRunning] = useState(false)
  if (!active) return null
  const label = module === 'any' ? '' : MODULES.find((m) => m.id === module)!.label
  if (active.runs.length === 0)
    return (
      <Empty icon={<FlaskConical size={26} />} title="No analysis has been performed on this dataset" text={`${active.name} is loaded and validated, but no analysis has been run yet. Results from other datasets are never shown here.`} action={<Btn variant="primary" onClick={() => { draftFromDataset(active.id); go('/new/analysis') }}><Play size={15} /> Start Analysis</Btn>} />
    )
  if (module !== 'any' && !active.done[module])
    return (
      <Empty
        icon={<FlaskConical size={26} />}
        title={`${label} has not been run for this dataset`}
        text="Run this module to compute its results from the dataset. Other modules and datasets are unaffected."
        action={
          <Btn
            variant="primary"
            disabled={running}
            onClick={async () => {
              setRunning(true)
              try {
                const ok = await runModules(active.id, [module])
                if (ok) notify('analysis', `${label} completed for ${active.name}.`, active.id)
              } finally {
                setRunning(false)
              }
            }}
          >
            <Play size={15} /> {running ? `Running ${label}...` : `Run ${label}`}
          </Btn>
        }
      />
    )
  return <>{children}</>
}

export function Filters({ show }: { show: ('group' | 'sample' | 'level' | 'topN' | 'mode' | 'metric')[] }) {
  const { filters, setFilters } = useApp()
  const { M, levels, level, d } = useData()
  const samplesIn = M.samples.filter((s) => filters.group === 'all' || M.groupOf[s] === filters.group)
  return (
    <Card lift={false} className="mb-5 p-4">
      <div className="flex flex-wrap items-end gap-3">
        {show.includes('metric') && <div className="min-w-44 flex-1"><Select label="Metric" value={filters.metric} onChange={(v) => setFilters({ metric: v as never })} options={[{ value: 'observed', label: 'Observed Features' }, { value: 'shannon', label: 'Shannon Index' }, { value: 'simpson', label: 'Simpson Index (1 − D)' }, { value: 'pielou', label: "Pielou's Evenness" }]} /></div>}
        {show.includes('level') && <div className="min-w-40 flex-1"><Select label="Taxonomic rank" value={level} onChange={(v) => setFilters({ level: v })} options={LEVELS.map((l) => ({ value: l, label: levels.includes(l) ? l : `${l} (no data)`, disabled: !levels.includes(l) }))} /></div>}
        {show.includes('topN') && <div className="min-w-28 flex-1"><Select label="Top N" value={String(filters.topN)} onChange={(v) => setFilters({ topN: +v })} options={['5', '8', '10', '15', '20']} /></div>}
        {show.includes('group') && <div className="min-w-40 flex-1"><Select label="Group" value={filters.group} onChange={(v) => setFilters({ group: v, sample: 'all' })} options={[{ value: 'all', label: 'All groups' }, ...d.groups.map((g) => ({ value: g, label: g }))]} /></div>}
        {show.includes('sample') && <div className="min-w-40 flex-1"><Select label="Sample" value={filters.sample} onChange={(v) => setFilters({ sample: v })} options={[{ value: 'all', label: 'All samples' }, ...samplesIn.map((g) => ({ value: g, label: g }))]} /></div>}
        {show.includes('mode') && <div><span className="label mb-1.5 block">Abundance</span><Segmented value={filters.mode} onChange={(v) => setFilters({ mode: v })} options={[{ value: 'relative', label: 'Relative %' }, { value: 'raw', label: 'Raw' }]} /></div>}
      </div>
    </Card>
  )
}

export function ChartCard({ title, sub, children, right }: { title: string; sub?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div><h3 className="font-bold">{title}</h3>{sub && <p className="sci text-xs text-muted">{sub}</p>}</div>
        {right}
      </div>
      {children}
    </Card>
  )
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return <p className={`sci rounded-xl border p-3 text-sm ${tone === 'warn' ? 'border-warn/40 bg-warn/10' : 'border-brand/30 bg-brand/10'}`}>{children}</p>
}

export { ChipSelect }
