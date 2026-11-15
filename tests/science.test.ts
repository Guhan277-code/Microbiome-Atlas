import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_PCOA_SAMPLES,
  aggregate,
  alphaDiv,
  bcPair,
  brayCurtis,
  buildMatrix,
  detectMapping,
  mapRecords,
  parseCSV,
  pcoa,
  relMatrix,
  toCSV,
  validate,
} from '../src/lib/science.ts'
import { SAMPLES, sampleCSV } from '../src/lib/samples.ts'

const approx = (actual: number, expected: number, eps = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${actual} ≈ ${expected} (±${eps})`)
}

test('relMatrix normalizes positive samples and guards zero-total rows', () => {
  const R = relMatrix([
    [10, 30, 60],
    [0, 0, 0],
  ])
  approx(R[0][0], 0.1)
  approx(R[0][1], 0.3)
  approx(R[0][2], 0.6)
  approx(R[0].reduce((a, b) => a + b, 0), 1)
  assert.deepEqual(R[1], [0, 0, 0])
})

test('alphaDiv matches analytical Shannon, Gini-Simpson (1-D), Observed, and Pielou definitions', () => {
  const raw = parseCSV(
    [
      'sample_id,feature_id,organism,taxonomic_rank,abundance,sample_group,lineage',
      'S_EQ,F1,Tax1,genus,100,A,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Tax1',
      'S_EQ,F2,Tax2,genus,100,A,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Tax2',
      'S_EQ,F3,Tax3,genus,100,A,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Tax3',
      'S_EQ,F4,Tax4,genus,100,A,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Tax4',
      'S_UN,F1,Tax1,genus,10,B,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Tax1',
      'S_UN,F2,Tax2,genus,20,B,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Tax2',
      'S_UN,F3,Tax3,genus,70,B,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Tax3',
      'S_ONE,F1,Tax1,genus,50,C,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Tax1',
      'S_ONE,F2,Tax2,genus,0,C,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Tax2',
    ].join('\n'),
  )
  const recs = mapRecords(raw, detectMapping(raw.headers))
  const M = buildMatrix(recs)
  const div = alphaDiv(M)

  const eq = div.find((r) => r.sample === 'S_EQ')!
  assert.equal(eq.observed, 4)
  approx(eq.shannon, Math.log(4))
  approx(eq.simpson, 0.75)
  approx(eq.pielou!, 1.0)

  const un = div.find((r) => r.sample === 'S_UN')!
  const expectedH = -(0.1 * Math.log(0.1) + 0.2 * Math.log(0.2) + 0.7 * Math.log(0.7))
  assert.equal(un.observed, 3)
  approx(un.shannon, expectedH)
  approx(un.simpson, 1 - (0.01 + 0.04 + 0.49))
  approx(un.pielou!, expectedH / Math.log(3))

  const one = div.find((r) => r.sample === 'S_ONE')!
  assert.equal(one.observed, 1)
  assert.equal(Object.is(one.shannon, 0), true, 'Shannon for single taxon must be +0, not -0')
  assert.equal(Object.is(one.simpson, 0), true, 'Simpson for single taxon must be +0, not -0')
  assert.equal(one.pielou, null, 'Pielou evenness must be null when S=1')
})

test('brayCurtis and pcoa satisfy mathematical metric and boundary invariants', () => {
  approx(bcPair([0.5, 0.5, 0], [0.5, 0.5, 0]), 0)
  approx(bcPair([1, 0, 0], [0, 1, 0]), 1)
  approx(bcPair([0.5, 0.5, 0], [0.25, 0.75, 0]), 0.25)

  const D = brayCurtis([
    [0.8, 0.2, 0.0, 0.0],
    [0.7, 0.2, 0.1, 0.0],
    [0.0, 0.1, 0.7, 0.2],
    [0.0, 0.0, 0.3, 0.7],
  ])
  for (let i = 0; i < D.length; i++) {
    assert.equal(D[i][i], 0)
    for (let j = 0; j < D.length; j++) approx(D[i][j], D[j][i])
  }

  const pc = pcoa(D)
  assert.ok(pc, 'PCoA should succeed on non-degenerate 4-sample distance matrix')
  assert.equal(pc!.coords.length, 4)
  assert.equal(pc!.explained.length, 2)
  assert.ok(pc!.explained[0] >= pc!.explained[1] && pc!.explained[0] <= 1)

  assert.equal(pcoa(D.slice(0, 2).map((r) => r.slice(0, 2))), null, 'PCoA returns null for < 3 samples')
  assert.equal(
    pcoa(
      Array.from({ length: 3 }, () => [0, 0, 0]),
    ),
    null,
    'PCoA returns null for identical zero distances',
  )
  const tooMany = Array.from({ length: MAX_PCOA_SAMPLES + 1 }, () =>
    new Array(MAX_PCOA_SAMPLES + 1).fill(0),
  )
  assert.equal(pcoa(tooMany), null, 'PCoA enforces browser sample cap cleanly')
})

test('validation handles missing values, zero totals, negatives, duplicates, conflicts, and outlier IQR=0 safely', () => {
  const csv = [
    'sample_id,feature_id,organism,taxonomic_rank,abundance,sample_group,lineage',
    '',
    'S1,F1,Bacillus,genus,10,G1,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Bacillus',
    'S1,F1,Bacillus,genus,5,G1,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Bacillus',
    'S1,F2,Prevotella,genus,,G1,Bacteria;Bacteroidota;Bacteroidia;Bacteroidales;Prevotellaceae;Prevotella',
    'S2,F1,DifferentOrg,genus,10,G2,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Bacillus',
    'S2,F2,Prevotella,genus,20,G1_CONFLICT,Bacteria;Bacteroidota;Bacteroidia;Bacteroidales;Prevotellaceae;Prevotella',
    'S_ZERO,F1,Bacillus,genus,0,G3,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Bacillus',
    'S_NEG,F1,Bacillus,genus,-3,G3,Bacteria;Firmicutes;Bacilli;Bacillales;Bacillaceae;Bacillus',
  ].join('\n')

  const raw = parseCSV(csv)
  const m = detectMapping(raw.headers)
  const recs = mapRecords(raw, m)
  assert.equal(recs[0].row, 3, 'Blank CSV lines should keep exact physical 1-based row numbers')

  const checks = validate(raw, m, recs)
  const byId = new Map(checks.map((c) => [c.id, c]))
  assert.equal(byId.get('abm')?.status, 'warn', 'Blank cell must warn instead of converting to zero')
  assert.equal(byId.get('dup')?.status, 'warn')
  assert.equal(byId.get('neg')?.status, 'error')
  assert.equal(byId.get('zero')?.status, 'warn')
  assert.equal(byId.get('sgrp_conflict')?.status, 'warn')
  assert.equal(byId.get('fmeta_conflict')?.status, 'warn')

  const M = buildMatrix(recs)
  assert.equal(M.zeroTotal.includes('S_ZERO'), true)
  const s1Idx = M.samples.indexOf('S1')
  const f1Idx = M.features.indexOf('F1')
  const f2Idx = M.features.indexOf('F2')
  assert.equal(M.X[s1Idx][f1Idx], 15, 'Duplicate valid rows must be summed')
  assert.equal(M.X[s1Idx][f2Idx], 0, 'Excluded blank cell contributes 0 to matrix entry but total stays valid')
  assert.equal(M.samples.includes('S_NEG'), false, 'Negative abundance row is excluded from matrix')
})

test('all-zero dataset fails validation cleanly with pos error check', () => {
  const raw = parseCSV(
    [
      'sample_id,feature_id,organism,taxonomic_rank,abundance,sample_group',
      'S1,F1,Bacillus,genus,0,G1',
      'S2,F1,Bacillus,genus,,G1',
    ].join('\n'),
  )
  const m = detectMapping(raw.headers)
  const recs = mapRecords(raw, m)
  const checks = validate(raw, m, recs)
  const pos = checks.find((c) => c.id === 'pos')
  assert.equal(pos?.status, 'error')
})

test('iqr=0 does not produce false outlier warnings', () => {
  const rows = Array.from({ length: 12 }, (_, i) => `S${i + 1},F1,Bacillus,genus,${i < 10 ? 10 : 25},G1`).join('\n')
  const raw = parseCSV(`sample_id,feature_id,organism,taxonomic_rank,abundance,sample_group\n${rows}`)
  const m = detectMapping(raw.headers)
  const recs = mapRecords(raw, m)
  const unu = validate(raw, m, recs).find((c) => c.id === 'unu')
  assert.equal(unu?.status, 'pass')
  assert.equal(unu?.count, 0)
})

test('parseCSV and validate catch malformed quotes, mismatched columns, duplicate headers, and duplicate mappings', () => {
  const unclosed = parseCSV('a,b\n"unterminated,2')
  assert.equal(unclosed.unclosedQuote, true)

  const dupColCsv = parseCSV('sample_id,feature_id,organism,taxonomic_rank,abundance,sample_group,sample_id\nS1,F1,B,genus,1,G1,S2')
  const dupHdrCheck = validate(dupColCsv, detectMapping(dupColCsv.headers), []).find((c) => c.id === 'csvfmt')
  assert.equal(dupHdrCheck?.status, 'error')

  const raggedCsv = parseCSV('sample_id,feature_id,organism,taxonomic_rank,abundance,sample_group\nS1,F1,B,genus,1')
  const raggedCheck = validate(raggedCsv, detectMapping(raggedCsv.headers), []).find((c) => c.id === 'csvfmt')
  assert.equal(raggedCheck?.status, 'error')
  assert.deepEqual(raggedCheck?.rows, [2])

  const dupMapCheck = validate(
    raggedCsv,
    {
      sample_id: 'sample_id',
      feature_id: 'sample_id',
      organism: 'organism',
      taxonomic_rank: 'taxonomic_rank',
      abundance: 'abundance',
      sample_group: 'sample_group',
    },
    [],
  ).find((c) => c.id === 'dupmap')
  assert.equal(dupMapCheck?.status, 'error')
})

test('buildMatrix is safe against Object.prototype property names like toString and constructor', () => {
  const raw = parseCSV(
    [
      'sample_id,feature_id,organism,taxonomic_rank,abundance,sample_group',
      'toString,F1,Bacillus,genus,12,GroupA',
      'constructor,F1,Bacillus,genus,8,GroupB',
    ].join('\n'),
  )
  const m = detectMapping(raw.headers)
  const M = buildMatrix(mapRecords(raw, m))
  assert.equal(M.groupOf['toString'], 'GroupA')
  assert.equal(M.groupOf['constructor'], 'GroupB')
})

test('aggregate preserves lineage rank positions and falls back to organism/rank when lineage omits deeper level', () => {
  const raw = parseCSV(
    [
      'sample_id,feature_id,organism,taxonomic_rank,abundance,sample_group,lineage',
      'S1,F1,Lactobacillus,genus,30,G1,Bacteria;Firmicutes;;;Lactobacillus',
      'S1,F2,Vibrio,genus,70,G1,Bacteria;Proteobacteria',
    ].join('\n'),
  )
  const m = detectMapping(raw.headers)
  const M = buildMatrix(mapRecords(raw, m))
  const classAgg = aggregate(M, 'Class')
  assert.equal(classAgg.names.includes('Lactobacillus'), false, 'Empty middle ranks must not shift Genus up into Class')

  const genusAgg = aggregate(M, 'Genus')
  assert.deepEqual(genusAgg.names.sort(), ['Lactobacillus', 'Vibrio'])
})

test('toCSV neutralizes formula injection in string cells without corrupting negative numbers', () => {
  const csv = toCSV(
    ['label', 'value'],
    [
      ['=CMD|calc', -0.456],
      ['+SUM(1,2)', 12],
      ['-2+3', 0],
      ['@HYPERLINK', null],
      ['\tcmd', 1],
    ],
  )
  const lines = csv.split('\n')
  assert.equal(lines[1], "'=CMD|calc,-0.456")
  assert.equal(lines[2], `"'${'+SUM(1,2)'}",12`)
  assert.equal(lines[3], "'-2+3,0")
  assert.equal(lines[4], "'@HYPERLINK,")
  assert.equal(lines[5], "'\tcmd,1")
})

test('all built-in demo datasets pass validation cleanly (marine has expected 1 blank-cell warning)', () => {
  for (const s of SAMPLES) {
    const raw = parseCSV(sampleCSV(s))
    const m = detectMapping(raw.headers)
    const recs = mapRecords(raw, m)
    const checks = validate(raw, m, recs)
    const errors = checks.filter((c) => c.status === 'error')
    const warns = checks.filter((c) => c.status === 'warn')
    assert.equal(errors.length, 0, `${s.key} should have 0 validation errors`)
    if (s.key === 'marine') {
      assert.equal(warns.length, 1)
      assert.equal(warns[0].id, 'abm')
      assert.equal(warns[0].count, 1)
    } else {
      assert.equal(warns.length, 0, `${s.key} should have 0 validation warnings`)
    }
  }
})
