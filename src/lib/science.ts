export type Field =
  | 'sample_id'
  | 'feature_id'
  | 'organism'
  | 'taxonomic_rank'
  | 'abundance'
  | 'sample_group'
  | 'lineage'

export const FIELDS: { key: Field; required: boolean; help: string }[] = [
  { key: 'sample_id', required: true, help: 'Identifies the biological sample each row belongs to (e.g. S01). Rows with the same value are pooled into one community.' },
  { key: 'feature_id', required: true, help: 'A unique ID for the taxon/feature (OTU, ASV or taxon code). Together with sample_id it must be unique per row.' },
  { key: 'organism', required: true, help: 'The organism or taxon name shown in charts and tables (e.g. Bacillus).' },
  { key: 'taxonomic_rank', required: true, help: 'The rank of the organism name in this row (e.g. genus, species). Taxonomy is never guessed if missing.' },
  { key: 'abundance', required: true, help: 'A non-negative numeric abundance, usually a sequencing read count. Reads are not direct cell counts.' },
  { key: 'sample_group', required: true, help: 'Experimental or sampling group for each sample (e.g. Group A). Used for group comparisons and colouring.' },
  { key: 'lineage', required: false, help: 'Optional. Semicolon-separated lineage from Kingdom to Species (e.g. Bacteria;Firmicutes;Bacilli;...). Enables higher taxonomic levels and the taxonomy tree.' },
]

export const LEVELS = ['Kingdom', 'Phylum', 'Class', 'Order', 'Family', 'Genus', 'Species'] as const
export type Mapping = Partial<Record<Field, string>>
export interface RawTable {
  headers: string[]
  rows: string[][]
}

export function parseCSV(text: string): RawTable {
  const rows: string[][] = []
  let cur: string[] = []
  let f = ''
  let q = false
  const t = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          f += '"'
          i++
        } else q = false
      } else f += c
    } else if (c === '"') q = true
    else if (c === ',') {
      cur.push(f)
      f = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      cur.push(f)
      f = ''
      if (cur.some((x) => x.trim() !== '') || cur.length > 1) rows.push(cur)
      cur = []
    } else f += c
  }
  if (f !== '' || cur.length) {
    cur.push(f)
    if (cur.some((x) => x.trim() !== '')) rows.push(cur)
  }
  const headers = (rows.shift() ?? []).map((h) => h.trim())
  return { headers, rows }
}

const SYN: Record<Field, string[]> = {
  sample_id: ['sample_id', 'sample', 'sampleid', 'sample_name'],
  feature_id: ['feature_id', 'otu', 'otu_id', 'asv', 'asv_id', 'feature', 'taxon_id'],
  organism: ['organism', 'taxon', 'taxa', 'organism_name', 'name'],
  taxonomic_rank: ['taxonomic_rank', 'rank', 'tax_rank', 'taxon_rank'],
  abundance: ['abundance', 'count', 'counts', 'reads', 'read_count', 'value'],
  sample_group: ['sample_group', 'group', 'condition', 'treatment'],
  lineage: ['lineage', 'taxonomy', 'taxonomic_lineage'],
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
export function detectMapping(headers: string[]): Mapping {
  const m: Mapping = {}
  const used = new Set<string>()
  for (const f of FIELDS) {
    const h = headers.find((x) => !used.has(x) && SYN[f.key].includes(norm(x)))
    if (h) {
      m[f.key] = h
      used.add(h)
    }
  }
  return m
}

export interface Rec {
  row: number
  sample: string
  feature: string
  organism: string
  rank: string
  abRaw: string
  abundance: number | null
  group: string
  lineage: string
}
export function mapRecords(raw: RawTable, m: Mapping): Rec[] {
  const idx = (k: Field) => (m[k] ? raw.headers.indexOf(m[k]!) : -1)
  const ix = Object.fromEntries(FIELDS.map((f) => [f.key, idx(f.key)])) as Record<Field, number>
  const g = (r: string[], k: Field) => (ix[k] >= 0 ? (r[ix[k]] ?? '').trim() : '')
  return raw.rows.map((r, i) => {
    const abRaw = g(r, 'abundance')
    const n = abRaw === '' ? null : Number(abRaw)
    return {
      row: i + 2,
      sample: g(r, 'sample_id'),
      feature: g(r, 'feature_id'),
      organism: g(r, 'organism'),
      rank: g(r, 'taxonomic_rank'),
      abRaw,
      abundance: n !== null && Number.isFinite(n) ? n : null,
      group: g(r, 'sample_group'),
      lineage: g(r, 'lineage'),
    }
  })
}

export interface Check {
  id: string
  title: string
  status: 'pass' | 'warn' | 'error'
  count: number
  rows: number[]
  explanation: string
  action: string
}

function quantile(a: number[], q: number) {
  if (!a.length) return NaN
  const s = [...a].sort((x, y) => x - y)
  const p = (s.length - 1) * q
  const lo = Math.floor(p)
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (p - lo)
}
export { quantile }

export function validate(raw: RawTable, m: Mapping, recs: Rec[]): Check[] {
  const out: Check[] = []
  const missingCols = FIELDS.filter((f) => f.required && (!m[f.key] || !raw.headers.includes(m[f.key]!)))
  out.push({
    id: 'cols',
    title: 'Required columns mapped',
    status: missingCols.length ? 'error' : 'pass',
    count: missingCols.length,
    rows: [],
    explanation: missingCols.length ? `Not mapped: ${missingCols.map((f) => f.key).join(', ')}.` : 'All required fields are mapped to CSV columns.',
    action: missingCols.length ? 'Return to column configuration and map every required field.' : 'No action needed.',
  })
  if (raw.rows.length === 0) {
    out.push({ id: 'empty', title: 'Dataset contains rows', status: 'error', count: 0, rows: [], explanation: 'The CSV has a header but no data rows.', action: 'Upload a CSV with data rows.' })
  }
  const mk = (id: string, title: string, rows: number[], sev: 'warn' | 'error', expl: string, action: string, okText: string): Check => ({
    id,
    title,
    status: rows.length ? sev : 'pass',
    count: rows.length,
    rows,
    explanation: rows.length ? expl : okText,
    action: rows.length ? action : 'No action needed.',
  })
  const R = (f: (r: Rec) => boolean) => recs.filter(f).map((r) => r.row)
  if (!missingCols.length) {
    out.push(mk('sid', 'Sample IDs present', R((r) => !r.sample), 'warn', 'Rows without a sample ID cannot be assigned to a community and are excluded from calculations.', 'Fill in sample IDs in the source file, or accept the exclusion.', 'Every row has a sample ID.'))
    out.push(mk('fid', 'Feature IDs present', R((r) => !r.feature), 'warn', 'Rows without a feature ID are excluded from calculations.', 'Provide feature IDs in the source file.', 'Every row has a feature ID.'))
    out.push(mk('org', 'Organism names present', R((r) => !r.organism), 'warn', 'Organism names are left blank; they are not inferred. These rows still count towards totals.', 'Add organism names in the source file.', 'Every row has an organism name.'))
    out.push(mk('rank', 'Taxonomic ranks present', R((r) => !r.rank), 'warn', 'Missing ranks are not guessed. Rank-based views treat them as unassigned.', 'Add taxonomic ranks in the source file.', 'Every row has a taxonomic rank.'))
    out.push(mk('abm', 'Abundance values present', R((r) => r.abRaw === ''), 'warn', 'Missing abundances are NOT treated as zero. These rows are excluded from calculations.', 'Confirm whether the taxon was absent or unmeasured and correct the file.', 'No missing abundance values.'))
    out.push(mk('abn', 'Abundance values numeric', R((r) => r.abRaw !== '' && r.abundance === null), 'warn', 'Non-numeric abundance text was found. These rows are excluded.', 'Replace the text with numbers (check decimal separators).', 'All abundance values are numeric.'))
    out.push(mk('neg', 'No negative abundances', R((r) => r.abundance !== null && r.abundance < 0), 'error', 'Negative abundances are not valid for counts or proportions. This is a critical error.', 'Correct or remove the negative values in the source file and re-upload.', 'No negative abundance values.'))
    const seen = new Map<string, number>()
    const dups: number[] = []
    for (const r of recs) {
      if (!r.sample || !r.feature) continue
      const k = r.sample + '\u0001' + r.feature
      if (seen.has(k)) dups.push(r.row)
      else seen.set(k, r.row)
    }
    out.push(mk('dup', 'Unique sample-feature combinations', dups, 'warn', 'Repeated sample/feature pairs were found. In calculations their abundances are summed; the original rows are not altered.', 'Check whether duplicates are technical replicates or errors.', 'Each sample-feature pair occurs once.'))
    out.push(mk('grp', 'Sample groups present', R((r) => !r.group), 'warn', 'Samples without a group appear as "Ungrouped" in group views.', 'Add the sample group in the source file.', 'Every row has a sample group.'))
    const M = buildMatrix(recs)
    out.push({
      id: 'zero',
      title: 'No zero-total samples',
      status: M.zeroTotal.length ? 'warn' : 'pass',
      count: M.zeroTotal.length,
      rows: recs.filter((r) => M.zeroTotal.includes(r.sample)).map((r) => r.row),
      explanation: M.zeroTotal.length ? `Samples with total abundance 0 (${M.zeroTotal.join(', ')}) cannot yield proportions and are excluded from diversity and composition calculations.` : 'Every sample has a positive total abundance.',
      action: M.zeroTotal.length ? 'Review whether these samples failed sequencing.' : 'No action needed.',
    })
    const pos = recs.filter((r) => r.abundance !== null && r.abundance > 0).map((r) => Math.log10(1 + r.abundance!))
    const q1 = quantile(pos, 0.25)
    const q3 = quantile(pos, 0.75)
    const hi = q3 + 3 * (q3 - q1)
    out.push(mk('unu', 'No unusual abundance values', pos.length > 8 ? R((r) => r.abundance !== null && r.abundance > 0 && Math.log10(1 + r.abundance) > hi) : [], 'warn', 'Values far above the typical range (log10 scale, 3×IQR rule) may be outliers or data-entry errors. They are kept unchanged.', 'Inspect these rows; keep them if they are biologically real.', 'No extreme outliers detected.'))
  }
  return out
}

export interface Matrix {
  samples: string[]
  features: string[]
  groupOf: Record<string, string>
  X: number[][]
  meta: { organism: string; rank: string; lineage: string }[]
  zeroTotal: string[]
  usedRows: number
}
export function buildMatrix(recs: Rec[]): Matrix {
  const valid = recs.filter((r) => r.sample && r.feature && r.abundance !== null && r.abundance >= 0)
  const sIdx = new Map<string, number>()
  const fIdx = new Map<string, number>()
  const groupOf: Record<string, string> = {}
  const meta: Matrix['meta'] = []
  for (const r of valid) {
    if (!sIdx.has(r.sample)) sIdx.set(r.sample, sIdx.size)
    if (!fIdx.has(r.feature)) {
      fIdx.set(r.feature, fIdx.size)
      meta.push({ organism: r.organism || r.feature, rank: r.rank, lineage: r.lineage })
    }
    if (!groupOf[r.sample] || groupOf[r.sample] === 'Ungrouped') groupOf[r.sample] = r.group || 'Ungrouped'
  }
  const all = [...sIdx.keys()]
  const X0 = all.map(() => new Array(fIdx.size).fill(0))
  for (const r of valid) X0[sIdx.get(r.sample)!][fIdx.get(r.feature)!] += r.abundance!
  const keep = all.map((_, i) => X0[i].reduce((a, b) => a + b, 0) > 0)
  return {
    samples: all.filter((_, i) => keep[i]),
    features: [...fIdx.keys()],
    groupOf,
    X: X0.filter((_, i) => keep[i]),
    meta,
    zeroTotal: all.filter((_, i) => !keep[i]),
    usedRows: valid.length,
  }
}

export const rowTotals = (X: number[][]) => X.map((r) => r.reduce((a, b) => a + b, 0))
export const relMatrix = (X: number[][]) => X.map((r) => { const t = r.reduce((a, b) => a + b, 0); return r.map((v) => (t ? v / t : 0)) })
export const groupsOf = (M: Matrix) => [...new Set(M.samples.map((s) => M.groupOf[s]))].sort()

/** Aggregate features to a taxonomic level. Never guesses missing taxonomy: unresolved features go to "Unassigned". */
export function aggregate(M: Matrix, level: (typeof LEVELS)[number]) {
  const li = LEVELS.indexOf(level)
  const names: string[] = []
  const map = new Map<string, number>()
  const to = M.meta.map((m) => {
    let n: string | undefined
    if (m.lineage) n = m.lineage.split(';').map((x) => x.trim())[li] || undefined
    else if (m.rank.toLowerCase() === level.toLowerCase()) n = m.organism
    const key = n ?? 'Unassigned'
    if (!map.has(key)) {
      map.set(key, names.length)
      names.push(key)
    }
    return map.get(key)!
  })
  const X = M.X.map((row) => {
    const o = new Array(names.length).fill(0)
    row.forEach((v, j) => (o[to[j]] += v))
    return o
  })
  return { names, X, assigned: names.filter((n) => n !== 'Unassigned').length > 0 }
}
export function availableLevels(M: Matrix) {
  return LEVELS.filter((l) => aggregate(M, l).assigned)
}

export interface AlphaRow {
  sample: string
  group: string
  observed: number
  shannon: number
  simpson: number
  pielou: number | null
}
/** Shannon uses natural log. Simpson reported as Gini-Simpson 1 - sum(p^2). Pielou = H / ln(S). */
export function alphaDiv(M: Matrix): AlphaRow[] {
  return M.samples.map((s, i) => {
    const t = M.X[i].reduce((a, b) => a + b, 0)
    const p = M.X[i].filter((v) => v > 0).map((v) => v / t)
    const H = -p.reduce((a, x) => a + x * Math.log(x), 0)
    const D = p.reduce((a, x) => a + x * x, 0)
    return { sample: s, group: M.groupOf[s], observed: p.length, shannon: H, simpson: 1 - D, pielou: p.length > 1 ? H / Math.log(p.length) : null }
  })
}

export function brayCurtis(R: number[][]) {
  const n = R.length
  const D = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      let num = 0
      let den = 0
      for (let k = 0; k < R[i].length; k++) {
        num += Math.abs(R[i][k] - R[j][k])
        den += R[i][k] + R[j][k]
      }
      D[i][j] = D[j][i] = den ? num / den : 0
    }
  return D
}
export const bcPair = (a: number[], b: number[]) => brayCurtis([a, b])[0][1]

function jacobi(A: number[][]) {
  const n = A.length
  const a = A.map((r) => [...r])
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j]
    if (off < 1e-20) break
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-14) continue
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q])
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const akp = a[k][p]
          const akq = a[k][q]
          a[k][p] = c * akp - s * akq
          a[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k]
          const aqk = a[q][k]
          a[p][k] = c * apk - s * aqk
          a[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p]
          const vkq = V[k][q]
          V[k][p] = c * vkp - s * vkq
          V[k][q] = s * vkp + c * vkq
        }
      }
  }
  return { values: a.map((r, i) => r[i]), vectors: V }
}

/** Classical PCoA (Gower double-centring). Explained variation = eigenvalue / sum of positive eigenvalues. */
export function pcoa(D: number[][]) {
  const n = D.length
  if (n < 3 || n > 150) return null
  const A = D.map((r) => r.map((d) => -0.5 * d * d))
  const rm = A.map((r) => r.reduce((x, y) => x + y, 0) / n)
  const tm = rm.reduce((x, y) => x + y, 0) / n
  const G = A.map((r, i) => r.map((v, j) => v - rm[i] - rm[j] + tm))
  const { values, vectors } = jacobi(G)
  const order = values.map((v, i) => i).sort((a, b) => values[b] - values[a])
  const posSum = values.filter((v) => v > 1e-10).reduce((a, b) => a + b, 0)
  if (posSum <= 0) return null
  const take = order.slice(0, 2).filter((i) => values[i] > 1e-10)
  if (take.length < 2) return null
  return {
    coords: Array.from({ length: n }, (_, r) => take.map((i) => vectors[r][i] * Math.sqrt(values[i]))),
    explained: take.map((i) => values[i] / posSum),
  }
}

export function spearman(a: number[], b: number[]) {
  const rank = (v: number[]) => {
    const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0])
    const r = new Array(v.length)
    let i = 0
    while (i < idx.length) {
      let j = i
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1
      i = j + 1
    }
    return r
  }
  const ra = rank(a)
  const rb = rank(b)
  const n = a.length
  const ma = ra.reduce((x, y) => x + y, 0) / n
  const mb = rb.reduce((x, y) => x + y, 0) / n
  let sab = 0
  let saa = 0
  let sbb = 0
  for (let i = 0; i < n; i++) {
    sab += (ra[i] - ma) * (rb[i] - mb)
    saa += (ra[i] - ma) ** 2
    sbb += (rb[i] - mb) ** 2
  }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : NaN
}

export interface Derived {
  R: number[][]
  alpha: AlphaRow[]
  D: number[][]
  pc: ReturnType<typeof pcoa>
  groups: string[]
}
const cache = new WeakMap<Matrix, Derived>()
export function derive(M: Matrix): Derived {
  let d = cache.get(M)
  if (!d) {
    const R = relMatrix(M.X)
    const D = brayCurtis(R)
    d = { R, alpha: alphaDiv(M), D, pc: pcoa(D), groups: groupsOf(M) }
    cache.set(M, d)
  }
  return d
}

export const fmt = (v: number | null | undefined, d = 3) => (v === null || v === undefined || !Number.isFinite(v) ? 'n/a' : v.toLocaleString(undefined, { maximumFractionDigits: d }))
export const pct = (v: number, d = 2) => (v * 100).toFixed(d) + '%'
export const bytes = (n: number) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB')

export function toCSV(headers: string[], rows: (string | number | null)[][]) {
  const q = (v: string | number | null) => {
    const s = v === null ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return [headers, ...rows].map((r) => r.map(q).join(',')).join('\n')
}
