import { toCSV } from './science.ts'

// genus, kingdom, phylum, class, order, family
const POOL: Record<string, string[]> = {
  Bacillus: ['Bacteria', 'Firmicutes', 'Bacilli', 'Bacillales', 'Bacillaceae'],
  Paenibacillus: ['Bacteria', 'Firmicutes', 'Bacilli', 'Paenibacillales', 'Paenibacillaceae'],
  Lactobacillus: ['Bacteria', 'Firmicutes', 'Bacilli', 'Lactobacillales', 'Lactobacillaceae'],
  Streptococcus: ['Bacteria', 'Firmicutes', 'Bacilli', 'Lactobacillales', 'Streptococcaceae'],
  Staphylococcus: ['Bacteria', 'Firmicutes', 'Bacilli', 'Bacillales', 'Staphylococcaceae'],
  Clostridium: ['Bacteria', 'Firmicutes', 'Clostridia', 'Clostridiales', 'Clostridiaceae'],
  Faecalibacterium: ['Bacteria', 'Firmicutes', 'Clostridia', 'Eubacteriales', 'Oscillospiraceae'],
  Roseburia: ['Bacteria', 'Firmicutes', 'Clostridia', 'Lachnospirales', 'Lachnospiraceae'],
  Blautia: ['Bacteria', 'Firmicutes', 'Clostridia', 'Lachnospirales', 'Lachnospiraceae'],
  Ruminococcus: ['Bacteria', 'Firmicutes', 'Clostridia', 'Eubacteriales', 'Ruminococcaceae'],
  Veillonella: ['Bacteria', 'Firmicutes', 'Negativicutes', 'Veillonellales', 'Veillonellaceae'],
  Bacteroides: ['Bacteria', 'Bacteroidota', 'Bacteroidia', 'Bacteroidales', 'Bacteroidaceae'],
  Prevotella: ['Bacteria', 'Bacteroidota', 'Bacteroidia', 'Bacteroidales', 'Prevotellaceae'],
  Parabacteroides: ['Bacteria', 'Bacteroidota', 'Bacteroidia', 'Bacteroidales', 'Tannerellaceae'],
  Alistipes: ['Bacteria', 'Bacteroidota', 'Bacteroidia', 'Bacteroidales', 'Rikenellaceae'],
  Flavobacterium: ['Bacteria', 'Bacteroidota', 'Flavobacteriia', 'Flavobacteriales', 'Flavobacteriaceae'],
  Chitinophaga: ['Bacteria', 'Bacteroidota', 'Chitinophagia', 'Chitinophagales', 'Chitinophagaceae'],
  Bifidobacterium: ['Bacteria', 'Actinobacteriota', 'Actinomycetia', 'Bifidobacteriales', 'Bifidobacteriaceae'],
  Streptomyces: ['Bacteria', 'Actinobacteriota', 'Actinomycetia', 'Streptomycetales', 'Streptomycetaceae'],
  Mycobacterium: ['Bacteria', 'Actinobacteriota', 'Actinomycetia', 'Mycobacteriales', 'Mycobacteriaceae'],
  Arthrobacter: ['Bacteria', 'Actinobacteriota', 'Actinomycetia', 'Micrococcales', 'Micrococcaceae'],
  Rubrobacter: ['Bacteria', 'Actinobacteriota', 'Rubrobacteria', 'Rubrobacterales', 'Rubrobacteraceae'],
  Pseudomonas: ['Bacteria', 'Proteobacteria', 'Gammaproteobacteria', 'Pseudomonadales', 'Pseudomonadaceae'],
  Escherichia: ['Bacteria', 'Proteobacteria', 'Gammaproteobacteria', 'Enterobacterales', 'Enterobacteriaceae'],
  Klebsiella: ['Bacteria', 'Proteobacteria', 'Gammaproteobacteria', 'Enterobacterales', 'Enterobacteriaceae'],
  Vibrio: ['Bacteria', 'Proteobacteria', 'Gammaproteobacteria', 'Vibrionales', 'Vibrionaceae'],
  Alteromonas: ['Bacteria', 'Proteobacteria', 'Gammaproteobacteria', 'Alteromonadales', 'Alteromonadaceae'],
  Rhizobium: ['Bacteria', 'Proteobacteria', 'Alphaproteobacteria', 'Hyphomicrobiales', 'Rhizobiaceae'],
  Bradyrhizobium: ['Bacteria', 'Proteobacteria', 'Alphaproteobacteria', 'Hyphomicrobiales', 'Nitrobacteraceae'],
  Sphingomonas: ['Bacteria', 'Proteobacteria', 'Alphaproteobacteria', 'Sphingomonadales', 'Sphingomonadaceae'],
  Pelagibacter: ['Bacteria', 'Proteobacteria', 'Alphaproteobacteria', 'Pelagibacterales', 'Pelagibacteraceae'],
  Burkholderia: ['Bacteria', 'Proteobacteria', 'Betaproteobacteria', 'Burkholderiales', 'Burkholderiaceae'],
  Nitrosomonas: ['Bacteria', 'Proteobacteria', 'Betaproteobacteria', 'Nitrosomonadales', 'Nitrosomonadaceae'],
  Desulfovibrio: ['Bacteria', 'Desulfobacterota', 'Desulfovibrionia', 'Desulfovibrionales', 'Desulfovibrionaceae'],
  Acidobacterium: ['Bacteria', 'Acidobacteriota', 'Acidobacteriae', 'Acidobacteriales', 'Acidobacteriaceae'],
  Gemmatimonas: ['Bacteria', 'Gemmatimonadota', 'Gemmatimonadetes', 'Gemmatimonadales', 'Gemmatimonadaceae'],
  Prochlorococcus: ['Bacteria', 'Cyanobacteria', 'Cyanobacteriia', 'Synechococcales', 'Prochlorococcaceae'],
  Synechococcus: ['Bacteria', 'Cyanobacteria', 'Cyanobacteriia', 'Synechococcales', 'Synechococcaceae'],
  Akkermansia: ['Bacteria', 'Verrucomicrobiota', 'Verrucomicrobiae', 'Verrucomicrobiales', 'Akkermansiaceae'],
  Planctomyces: ['Bacteria', 'Planctomycetota', 'Planctomycetia', 'Planctomycetales', 'Planctomycetaceae'],
  Nitrosopumilus: ['Archaea', 'Thermoproteota', 'Nitrososphaeria', 'Nitrosopumilales', 'Nitrosopumilaceae'],
  Methanobrevibacter: ['Archaea', 'Methanobacteriota', 'Methanobacteria', 'Methanobacteriales', 'Methanobacteriaceae'],
}

export interface SampleDef {
  key: string
  name: string
  description: string
  prefix: string
  taxa: string[]
  groups: [string, number][]
  seed: number
  note?: string
}

export const SAMPLES: SampleDef[] = [
  {
    key: 'soil',
    name: 'Soil Microbiome',
    description: 'Illustrative demo: topsoil communities from three land-use types.',
    prefix: 'SOIL',
    seed: 11,
    groups: [['Forest', 4], ['Grassland', 4], ['Cropland', 4]],
    taxa: ['Bacillus', 'Streptomyces', 'Arthrobacter', 'Rubrobacter', 'Gemmatimonas', 'Acidobacterium', 'Bradyrhizobium', 'Sphingomonas', 'Pseudomonas', 'Burkholderia', 'Nitrosomonas', 'Nitrosopumilus', 'Chitinophaga', 'Flavobacterium', 'Rhizobium', 'Planctomyces', 'Paenibacillus', 'Clostridium', 'Mycobacterium'],
  },
  {
    key: 'gut',
    name: 'Human Gut Microbiome',
    description: 'Illustrative demo: stool-derived communities in two cohorts (Group A and Group B). Not clinical data.',
    prefix: 'GUT',
    seed: 23,
    groups: [['Group A', 8], ['Group B', 8]],
    taxa: ['Bacteroides', 'Prevotella', 'Parabacteroides', 'Alistipes', 'Faecalibacterium', 'Roseburia', 'Blautia', 'Ruminococcus', 'Clostridium', 'Lactobacillus', 'Streptococcus', 'Veillonella', 'Bifidobacterium', 'Akkermansia', 'Escherichia', 'Klebsiella', 'Methanobrevibacter', 'Desulfovibrio', 'Staphylococcus'],
  },
  {
    key: 'marine',
    name: 'Marine Microbiome',
    description: 'Illustrative demo: seawater communities from surface and deep layers. Contains one intentionally blank abundance cell to demonstrate validation warnings.',
    prefix: 'SEA',
    seed: 37,
    note: 'blank',
    groups: [['Surface', 5], ['Deep', 5]],
    taxa: ['Pelagibacter', 'Prochlorococcus', 'Synechococcus', 'Alteromonas', 'Vibrio', 'Flavobacterium', 'Nitrosopumilus', 'Pseudomonas', 'Planctomyces', 'Sphingomonas', 'Desulfovibrio', 'Bacillus', 'Streptomyces', 'Rhizobium'],
  },
  {
    key: 'root',
    name: 'Plant Root Microbiome',
    description: 'Illustrative demo: communities from rhizosphere, root endosphere and bulk soil compartments.',
    prefix: 'ROOT',
    seed: 53,
    groups: [['Rhizosphere', 4], ['Root endosphere', 4], ['Bulk soil', 4]],
    taxa: ['Rhizobium', 'Bradyrhizobium', 'Pseudomonas', 'Bacillus', 'Streptomyces', 'Burkholderia', 'Sphingomonas', 'Flavobacterium', 'Chitinophaga', 'Paenibacillus', 'Arthrobacter', 'Acidobacterium', 'Nitrosomonas', 'Klebsiella', 'Clostridium', 'Gemmatimonas'],
  },
]

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}
function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())
}

export function sampleCSV(def: SampleDef): string {
  const r = rng(def.seed)
  const base = def.taxa.map(() => Math.exp(gauss(r) * 1.1))
  const gm = def.groups.map(() => def.taxa.map(() => 1))
  gm.forEach((row) => {
    for (let k = 0; k < 4; k++) row[Math.floor(r() * row.length)] = 3 + r() * 3
    for (let k = 0; k < 3; k++) row[Math.floor(r() * row.length)] = 0.15 + r() * 0.2
  })
  const rows: (string | number)[][] = []
  let blank = false
  def.groups.forEach(([g, n], gi) => {
    for (let s = 1; s <= n; s++) {
      const sid = `${def.prefix}_${String.fromCharCode(65 + gi)}${s}`
      const depth = 9000 + r() * 9000
      const w = def.taxa.map((_, t) => base[t] * gm[gi][t] * Math.exp(gauss(r) * 0.35))
      const tw = w.reduce((a, b) => a + b, 0)
      def.taxa.forEach((t, ti) => {
        const c = Math.round((depth * w[ti]) / tw)
        if (c <= 0) return
        const lin = [...POOL[t], t].join(';')
        const ab = def.note === 'blank' && !blank && gi === 0 && s === 2 && ti === 3 ? ((blank = true), '') : c
        rows.push([sid, `OTU_${String(ti + 1).padStart(3, '0')}`, t, 'genus', ab, g, lin])
      })
    }
  })
  return toCSV(['sample_id', 'feature_id', 'organism', 'taxonomic_rank', 'abundance', 'sample_group', 'lineage'], rows)
}

export const TEMPLATE_CSV = `sample_id,feature_id,organism,taxonomic_rank,abundance,sample_group,lineage
S1,OTU_001,Bacteroides,genus,1520,Group A,Bacteria;Bacteroidota;Bacteroidia;Bacteroidales;Bacteroidaceae;Bacteroides
S1,OTU_002,Lactobacillus,genus,310,Group A,Bacteria;Firmicutes;Bacilli;Lactobacillales;Lactobacillaceae;Lactobacillus
S2,OTU_001,Bacteroides,genus,980,Group B,Bacteria;Bacteroidota;Bacteroidia;Bacteroidales;Bacteroidaceae;Bacteroides
S2,OTU_002,Lactobacillus,genus,845,Group B,Bacteria;Firmicutes;Bacilli;Lactobacillales;Lactobacillaceae;Lactobacillus
`
