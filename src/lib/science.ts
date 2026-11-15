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
export const MAX_CSV_BYTES = 5 * 1024 * 1024
export const MAX_CSV_ROWS = 50_000
export const MAX_PCOA_SAMPLES = 150
export type Mapping = Partial<Record<Field, string>>
export interface RawTable {
  headers: string[]
  rows: string[][]
  rowNumbers?: number[]
  unclosedQuote?: boolean
  mismatchedRows?: number[]
  duplicateHeaders?: string[]
  truncatedAtLimit?: boolean
}

export function parseCSV(text: string): RawTable {
  const records: { fields: string[]; line: number }[] = []
  let cur: string[] = []
  let f = ''
  let q = false
  let lineNum = 1
  let recordStartLine = 1
  const t = text.replace(/^\uFEFF/, '')
  let truncatedAtLimit = false

  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          f += '"'
          i++
        } else q = false
      } else {
        if (c === '\r' && t[i + 1] === '\n') {
          f += '\n'
          i++
          lineNum++
        } else if (c === '\n' || c === '\r') {
          f += c
          lineNum++
        } else {
          f += c
        }
      }
    } else if (c === '"') {
      q = true
    } else if (c === ',') {
      cur.push(f)
      f = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      cur.push(f)
      f = ''
      if (cur.some((x) => x.trim() !== '') || cur.length > 1) {
        records.push({ fields: cur, line: recordStartLine })
        if (records.length > MAX_CSV_ROWS + 1) {
          truncatedAtLimit = true
          cur = []
          break
        }
      }
      cur = []
      lineNum++
      recordStartLine = lineNum
    } else {
      f += c
    }
  }
  if (!truncatedAtLimit && (f !== '' || cur.length)) {
    cur.push(f)
    if (cur.some((x) => x.trim() !== '') || cur.length > 1) {
      records.push({ fields: cur, line: recordStartLine })
      if (records.length > MAX_CSV_ROWS + 1) {
        truncatedAtLimit = true
      }
    }
  }

  const headerRec = records.shift()
  const headers = (headerRec?.fields ?? []).map((h) => h.trim())
  const dataRecords = truncatedAtLimit ? records.slice(0, MAX_CSV_ROWS) : records
  const headerCounts = new Map<string, number>()
  for (const h of headers) {
    if (!h) continue
    headerCounts.set(h, (headerCounts.get(h) ?? 0) + 1)
  }
  const duplicateHeaders = [...headerCounts.entries()].filter(([, n]) => n > 1).map(([h]) => h)
  const mismatchedRows = dataRecords
    .filter((r) => r.fields.length !== headers.length)
    .map((r) => r.line)

  return {
    headers,
    rows: dataRecords.map((r) => r.fields),
    rowNumbers: dataRecords.map((r) => r.line),
    unclosedQuote: q,
    mismatchedRows,
    duplicateHeaders,
    truncatedAtLimit,
  }
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
      row: raw.rowNumbers?.[i] ?? i + 2,
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

  const colUse = new Map<string, Field[]>()
  for (const f of FIELDS) {
    const col = m[f.key]
    if (col) {
      const list = colUse.get(col) ?? []
      list.push(f.key)
      colUse.set(col, list)
    }
  }
  const dupMappings = [...colUse.entries()].filter(([, fields]) => fields.length > 1)
  out.push({
    id: 'dupmap',
    title: 'Distinct CSV column per field',
    status: dupMappings.length ? 'error' : 'pass',
    count: dupMappings.length,
    rows: [],
    explanation: dupMappings.length
      ? `One CSV column is mapped to multiple fields: ${dupMappings.map(([c, fs]) => `${c} (${fs.join(', ')})`).join('; ')}.`
      : 'Each mapped field references a distinct CSV column.',
    action: dupMappings.length ? 'Return to column configuration and assign separate columns to each mapped field.' : 'No action needed.',
  })

  const formatIssues: string[] = []
  if (raw.unclosedQuote) formatIssues.push('unclosed quote')
  if ((raw.duplicateHeaders?.length ?? 0) > 0) formatIssues.push(`duplicate headers (${raw.duplicateHeaders!.join(', ')})`)
  if ((raw.mismatchedRows?.length ?? 0) > 0) formatIssues.push(`${raw.mismatchedRows!.length} row(s) with wrong column count`)
  if (raw.truncatedAtLimit) formatIssues.push(`exceeds ${MAX_CSV_ROWS.toLocaleString()} rows limit`)
  out.push({
    id: 'csvfmt',
    title: 'Well-formed CSV structure',
    status: formatIssues.length ? 'error' : 'pass',
    count: (raw.mismatchedRows?.length ?? 0) || formatIssues.length,
    rows: raw.mismatchedRows ?? [],
    explanation: formatIssues.length ? `CSV parsing errors detected: ${formatIssues.join('; ')}.` : 'CSV quotes, headers, and column counts per row are valid.',
    action: formatIssues.length ? 'Fix malformed quotes, duplicate headers, or misaligned columns in the CSV file and re-upload.' : 'No action needed.',
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
  if (!missingCols.length && !dupMappings.length && raw.rows.length > 0) {
    out.push(mk('sid', 'Sample IDs present', R((r) => !r.sample), 'warn', 'Rows without a sample ID cannot be assigned to a community and are excluded from calculations.', 'Fill in sample IDs in the source file, or accept the exclusion.', 'Every row has a sample ID.'))
    out.push(mk('fid', 'Feature IDs present', R((r) => !r.feature), 'warn', 'Rows without a feature ID are excluded from calculations.', 'Provide feature IDs in the source file.', 'Every row has a feature ID.'))
    out.push(mk('org', 'Organism names present', R((r) => !r.organism), 'warn', 'Organism names are left blank; they are not inferred. These rows still count towards totals.', 'Add organism names in the source file.', 'Every row has an organism name.'))
    out.push(mk('rank', 'Taxonomic ranks present', R((r) => !r.rank), 'warn', 'Missing ranks are not guessed. Rank-based views treat them as unassigned.', 'Add taxonomic ranks in the source file.', 'Every row has a taxonomic rank.'))
    out.push(mk('abm', 'Abundance values present', R((r) => r.abRaw === ''), 'warn', 'Missing abundances are NOT treated as zero. These rows are excluded from calculations.', 'Confirm whether the taxon was absent or unmeasured and correct the file.', 'No missing abundance values.'))
    out.push(mk('abn', 'Abundance values numeric', R((r) => r.abRaw !== '' && r.abundance === null), 'warn', 'Non-numeric abundance text was found. These rows are excluded.', 'Replace the text with numbers (check decimal separators).', 'All abundance values are numeric.'))
    out.push(mk('neg', 'No negative abundances', R((r) => r.abundance !== null && r.abundance < 0), 'error', 'Negative abundances are not valid for counts or proportions. This is a critical error.', 'Correct or remove the negative values in the source file and re-upload.', 'No negative abundance values.'))
    const seen = new Map<string, number>()
    const dups: number[] = []
    const sampleGroups = new Map<string, string>()
    const groupConflicts: number[] = []
    const featureMeta = new Map<string, string>()
    const featureConflicts: number[] = []
    for (const r of recs) {
      if (r.sample && r.feature) {
        const k = r.sample + '\u0001' + r.feature
        if (seen.has(k)) dups.push(r.row)
        else seen.set(k, r.row)
      }
      if (r.sample && r.group) {
        const prevGroup = sampleGroups.get(r.sample)
        if (!prevGroup) sampleGroups.set(r.sample, r.group)
        else if (prevGroup !== r.group) groupConflicts.push(r.row)
      }
      if (r.feature && (r.organism || r.rank || r.lineage)) {
        const sig = `${r.organism}\u0001${r.rank}\u0001${r.lineage}`
        const prevSig = featureMeta.get(r.feature)
        if (!prevSig) featureMeta.set(r.feature, sig)
        else if (prevSig !== sig) featureConflicts.push(r.row)
      }
    }
    out.push(mk('dup', 'Unique sample-feature combinations', dups, 'warn', 'Repeated sample/feature pairs were found. In calculations their abundances are summed; the original rows are not altered.', 'Check whether duplicates are technical replicates or errors.', 'Each sample-feature pair occurs once.'))
    out.push(mk('grp', 'Sample groups present', R((r) => !r.group), 'warn', 'Samples without a group appear as "Ungrouped" in group views.', 'Add the sample group in the source file.', 'Every row has a sample group.'))
    out.push(mk('sgrp_conflict', 'Consistent sample group per sample', groupConflicts, 'warn', 'Multiple conflicting sample_group values appear for the same sample_id. The first non-empty group is kept.', 'Verify sample metadata and assign one group per sample_id.', 'Each sample belongs to a single group.'))
    out.push(mk('fmeta_conflict', 'Consistent taxonomy per feature', featureConflicts, 'warn', 'Conflicting organism, rank, or lineage annotations appear for the same feature_id. The first annotation is used.', 'Standardize feature annotations per feature_id in the CSV.', 'Each feature_id has consistent taxonomy metadata.'))
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
    out.push({
      id: 'pos',
      title: 'At least one non-zero sample',
      status: M.samples.length === 0 ? 'error' : 'pass',
      count: M.samples.length === 0 ? recs.length : 0,
      rows: [],
      explanation: M.samples.length === 0
        ? 'No valid sample has a positive total abundance, so composition and diversity metrics cannot be computed.'
        : `${M.samples.length} sample(s) have positive total abundance and are ready for analysis.`,
      action: M.samples.length === 0 ? 'Provide at least one sample with valid positive numeric abundance.' : 'No action needed.',
    })
    const pos = recs.filter((r) => r.abundance !== null && r.abundance > 0).map((r) => Math.log10(1 + r.abundance!))
    const q1 = quantile(pos, 0.25)
    const q3 = quantile(pos, 0.75)
    const iqr = q3 - q1
    const hi = q3 + 3 * iqr
    out.push(mk('unu', 'No unusual abundance values', pos.length > 8 && iqr > 0 ? R((r) => r.abundance !== null && r.abundance > 0 && Math.log10(1 + r.abundance) > hi) : [], 'warn', 'Values far above the typical range (log10 scale, 3×IQR rule) may be outliers or data-entry errors. They are kept unchanged.', 'Inspect these rows; keep them if they are biologically real.', 'No extreme outliers detected.'))
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
  const groupOf = Object.create(null) as Record<string, string>
  const meta: Matrix['meta'] = []
  for (const r of valid) {
    if (!sIdx.has(r.sample)) sIdx.set(r.sample, sIdx.size)
    if (!fIdx.has(r.feature)) {
      fIdx.set(r.feature, fIdx.size)
      meta.push({ organism: r.organism || r.feature, rank: r.rank, lineage: r.lineage })
    }
    const existingGroup = groupOf[r.sample]
    if (existingGroup === undefined || (existingGroup === 'Ungrouped' && r.group)) {
      groupOf[r.sample] = r.group || 'Ungrouped'
    }
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
    if (m.lineage) {
      const seg = m.lineage.split(';').map((x) => x.trim())[li]
      if (seg) n = seg
    }
    if (!n && m.rank.toLowerCase() === level.toLowerCase() && m.organism) {
      n = m.organism
    }
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
    const p = t > 0 ? M.X[i].filter((v) => v > 0).map((v) => v / t) : []
    const hRaw = -p.reduce((a, x) => a + x * Math.log(x), 0)
    const H = Math.abs(hRaw) < 1e-12 ? 0 : hRaw
    const D = p.reduce((a, x) => a + x * x, 0)
    const sRaw = 1 - D
    const simpson = p.length ? (Math.abs(sRaw) < 1e-12 ? 0 : Math.max(0, Math.min(1, sRaw))) : 0
    return { sample: s, group: M.groupOf[s], observed: p.length, shannon: H, simpson, pielou: p.length > 1 ? H / Math.log(p.length) : null }
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
  if (n < 3 || n > MAX_PCOA_SAMPLES) return null
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
    if (v === null || v === undefined) return ''
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
    let s = String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return [headers, ...rows].map((r) => r.map(q).join(',')).join('\n')
}
