import { useState } from 'react'
import { ArrowRight, BarChart3, ChevronDown, Dna, FileText, Layers, Network, PlayCircle, Menu, X, GitCompare, ShieldCheck, Upload, Sparkles, Table2 } from 'lucide-react'
import { useApp } from '../store'
import { Btn, Card, Logo, Reveal, ThemeSwitch } from '../ui'

export function MicrobeArt() {
  const dots = Array.from({ length: 46 }, (_, i) => ({ x: 20 + ((i * 53) % 160), y: 8 + ((i * 29) % 44) }))
  const Cap = ({ x, y, r, s = 1, c1, c2, id }: { x: number; y: number; r: number; s?: number; c1: string; c2: string; id: string }) => (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="200" height="60" rx="30" fill={`url(#${id})`} />
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={2.4 + (i % 3)} fill="#fff" opacity={0.12 + (i % 4) * 0.05} />)}
      <rect x="14" y="6" width="150" height="14" rx="7" fill="#fff" opacity=".22" />
      <rect x="0" y="0" width="200" height="60" rx="30" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="2" />
    </g>
  )
  return (
    <svg viewBox="0 0 520 520" className="w-full" role="img" aria-label="Illustration of floating microbial structures">
      <defs>
        <radialGradient id="orb" cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="#4285F4" stopOpacity=".35" />
          <stop offset=".6" stopColor="#8B5CF6" stopOpacity=".12" />
          <stop offset="1" stopColor="#00D4FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sph" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#bfe9ff" />
          <stop offset=".45" stopColor="#4285F4" />
          <stop offset="1" stopColor="#3b1d8f" />
        </radialGradient>
        <radialGradient id="sph2" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#f0d9ff" />
          <stop offset=".5" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#1e1b6b" />
        </radialGradient>
      </defs>
      <circle cx="260" cy="260" r="240" fill="url(#orb)" />
      <circle cx="260" cy="260" r="228" fill="none" stroke="#00D4FF" strokeOpacity=".35" strokeWidth="1.5" />
      <circle cx="260" cy="260" r="200" fill="none" stroke="#8B5CF6" strokeOpacity=".25" strokeDasharray="3 8" />
      <g className="floaty" style={{ ['--r' as string]: '-28deg' }}><Cap id="c1" x={120} y={230} r={-28} c1="#79c0ff" c2="#4a38d8" /></g>
      <g className="floaty" style={{ ['--r' as string]: '18deg', animationDelay: '-2s' }}><Cap id="c2" x={230} y={150} r={18} s={0.8} c1="#c4a8ff" c2="#4285F4" /></g>
      <g className="floaty" style={{ ['--r' as string]: '-8deg', animationDelay: '-4s' }}><Cap id="c3" x={190} y={340} r={-8} s={0.7} c1="#7ef0ff" c2="#7b4df0" /></g>
      {[[90, 120, 28, 'sph'], [400, 110, 20, 'sph2'], [430, 330, 34, 'sph'], [140, 420, 18, 'sph2'], [350, 420, 14, 'sph'], [60, 300, 12, 'sph2'], [330, 70, 12, 'sph']].map(([x, y, r, f], i) => (
        <g key={i} className="floaty" style={{ animationDelay: -i * 1.1 + 's', animationDuration: 6 + i + 's' }}>
          <circle cx={x as number} cy={y as number} r={r as number} fill={`url(#${f})`} />
          <circle cx={(x as number) - (r as number) / 3} cy={(y as number) - (r as number) / 3} r={(r as number) / 4} fill="#fff" opacity=".45" />
        </g>
      ))}
    </svg>
  )
}

const FEATURES = [
  { i: BarChart3, t: 'Interactive Visualisations', d: 'Donut, stacked, heatmap, box and violin charts that respond to filters and dataset changes.' },
  { i: Dna, t: 'Diversity Analysis', d: 'Observed features, Shannon, Simpson (1 − D) and Pielou evenness, computed from your data.' },
  { i: Network, t: 'Taxonomic Explorer', d: 'Browse a lineage tree and inspect any taxon across samples and groups.' },
  { i: FileText, t: 'Scientific Reports', d: 'Reports built from your results with methods, validation warnings and limitations.' },
]
const STEPS = [
  ['Upload', 'Bring a prepared CSV of abundances or start from an illustrative sample dataset.'],
  ['Configure', 'Map your columns to the expected fields. Nothing is assigned silently.'],
  ['Validate', 'Review errors, warnings and affected rows before any calculation.'],
  ['Analyse', 'Choose modules and run computations in your browser.'],
  ['Report', 'Compare samples, generate a report and export tables or charts.'],
]
const FAQ = [
  ['Does Microbiome Atlas process raw sequencing files?', 'No. It analyses prepared abundance tables in CSV format. FASTQ files and sequencing pipelines are not supported.'],
  ['Is my data uploaded to a server?', 'Abundance data is parsed and computed in your browser tab for high performance, with datasets and analysis history securely synced to your Supabase account under Row Level Security.'],
  ['Are accounts real?', 'Yes. Authentication is fully powered by Supabase Auth with Row Level Security. You can create an account, sign in, or explore immediately using a local guest session.'],
  ['Does higher diversity mean a healthier microbiome?', 'No. Diversity metrics describe community structure. Interpretation depends on the habitat and study design.'],
  ['Can I use it to diagnose a condition?', 'No. The platform is for exploratory research analysis and does not provide diagnoses.'],
]

export default function Landing() {
  const { go, user, active } = useApp()
  const [open, setOpen] = useState(false)
  const [faq, setFaq] = useState<number | null>(0)
  const start = () => go(user ? (active ? '/app/overview' : '/new/upload') : '/signin')
  const scroll = (id: string) => { setOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }
  const links = [['features', 'Features'], ['how', 'How it works'], ['capabilities', 'Capabilities'], ['data', 'Data format'], ['faq', 'FAQ']]
  return (
    <div className="page-in relative overflow-x-hidden">
      <header className="sticky top-3 z-40 mx-auto mt-3 flex w-[min(1180px,calc(100%-24px))] items-center justify-between rounded-2xl border border-line bg-surface px-4 py-2.5 backdrop-blur-xl">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Logo /></button>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map(([id, l]) => <button key={id} onClick={() => scroll(id)} className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:text-ink">{l}</button>)}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeSwitch />
          <Btn size="sm" className="hidden sm:inline-flex" onClick={() => go(user ? '/app/overview' : '/signin')}>
            {user ? 'Workspace' : 'Sign in'}
          </Btn>
          <Btn variant="primary" size="sm" onClick={start}>Get Started <ArrowRight size={14} /></Btn>
          <button className="btn btn-icon btn-sm md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X size={16} /> : <Menu size={16} />}</button>
        </div>
        {open && (
          <div className="pop absolute top-full right-0 left-0 mt-2 rounded-2xl border border-line bg-solid p-2 md:hidden">
            {links.map(([id, l]) => <button key={id} onClick={() => scroll(id)} className="block w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-[var(--row)]">{l}</button>)}
            <button onClick={() => go(user ? '/app/overview' : '/signin')} className="block w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-[var(--row)]">{user ? 'Workspace' : 'Sign in'}</button>
          </div>
        )}
      </header>

      <section className="relative mx-auto grid w-[min(1180px,calc(100%-32px))] items-center gap-8 py-14 lg:grid-cols-2 lg:py-24">
        {Array.from({ length: 16 }, (_, i) => <i key={i} className="particle" style={{ left: (i * 61) % 100 + '%', top: 30 + ((i * 37) % 70) + '%', width: 4 + (i % 4) * 2, height: 4 + (i % 4) * 2, animationDelay: -i * 0.6 + 's', animationDuration: 6 + (i % 5) + 's' }} />)}
        <div className="relative z-10">
          <span className="chip bg-surface text-muted"><Sparkles size={13} className="text-cyan" /> Prepared-abundance microbiome analysis</span>
          <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">Explore the Hidden World of <span className="grad-text">Microbes</span></h1>
          <p className="sci mt-6 max-w-xl text-lg text-muted">Transform microbiome abundance data into meaningful scientific insights through interactive visualisation, diversity analysis and taxonomic exploration.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Btn variant="primary" className="!min-h-12 !px-6" onClick={start}>Get Started <ArrowRight size={16} /></Btn>
            <Btn className="!min-h-12 !px-6" onClick={() => scroll('features')}><PlayCircle size={16} /> Explore Platform</Btn>
          </div>
          <div className="stagger mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['7', 'Taxonomic levels'], ['4', 'Alpha metrics'], ['BC', 'Bray-Curtis + PCoA'], ['CSV', 'Input format']].map(([v, l]) => (
              <Card key={l} className="p-4"><div className="mono text-xl font-semibold">{v}</div><div className="text-xs text-muted">{l}</div></Card>
            ))}
          </div>
        </div>
        <div className="relative z-10 mx-auto w-full max-w-[560px]"><MicrobeArt /></div>
      </section>

      <section id="features" className="mx-auto w-[min(1180px,calc(100%-32px))] scroll-mt-24 py-14">
        <Reveal><h2 className="text-3xl font-bold">Powerful Features</h2><p className="sci mt-1 text-muted">Advanced tools for comprehensive microbiome analysis.</p></Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={i * 80}>
              <Card className="h-full p-6">
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand/30 to-violet/30 text-cyan"><f.i size={24} /></div>
                <h3 className="font-bold">{f.t}</h3>
                <p className="sci mt-2 text-sm text-muted">{f.d}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto w-[min(1180px,calc(100%-32px))] scroll-mt-24 py-14">
        <Reveal><h2 className="text-3xl font-bold">How it works</h2><p className="sci mt-1 text-muted">A guided scientific workflow. The workspace unlocks only after a dataset is loaded and validated.</p></Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-5">
          {STEPS.map(([t, d], i) => (
            <Reveal key={t} delay={i * 80}>
              <Card className="h-full p-5">
                <div className="mono mb-3 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-cyan text-sm font-bold text-[#04101f]">{i + 1}</div>
                <h3 className="font-bold">{t}</h3>
                <p className="sci mt-1.5 text-sm text-muted">{d}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="capabilities" className="mx-auto w-[min(1180px,calc(100%-32px))] scroll-mt-24 py-14">
        <Reveal><h2 className="text-3xl font-bold">Platform capabilities</h2><p className="sci mt-1 text-muted">Each capability is labelled by its real implementation status.</p></Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            [Upload, 'CSV ingestion & mapping', 'Implemented', 'Drag-and-drop upload, column mapping and local parsing.'],
            [ShieldCheck, 'Validation', 'Implemented', 'Twelve checks incl. negatives, duplicates, missing values and zero-total samples.'],
            [Layers, 'Composition', 'Implemented', 'Seven taxonomic levels (when lineage is provided), heatmaps and tables.'],
            [Dna, 'Alpha diversity', 'Implemented', 'Observed, Shannon (ln), Simpson 1 − D and Pielou evenness.'],
            [GitCompare, 'Beta diversity', 'Implemented', 'Bray-Curtis matrix and PCoA. NMDS is not implemented.'],
            [Table2, 'Advanced analytics', 'Experimental / Planned', 'Descriptive fold change and correlation tables. Machine learning and functional prediction are planned.'],
          ].map(([I, t, s, d], i) => {
            const Icon = I as typeof Upload
            return (
              <Reveal key={t as string} delay={(i % 3) * 80}>
                <Card className="h-full p-6">
                  <div className="flex items-center justify-between"><Icon className="text-cyan" size={22} /><span className="chip text-muted">{s as string}</span></div>
                  <h3 className="mt-4 font-bold">{t as string}</h3>
                  <p className="sci mt-1.5 text-sm text-muted">{d as string}</p>
                </Card>
              </Reveal>
            )
          })}
        </div>
      </section>

      <section id="data" className="mx-auto w-[min(1180px,calc(100%-32px))] scroll-mt-24 py-14">
        <Reveal>
          <Card lift={false} className="p-6 md:p-8">
            <h2 className="text-3xl font-bold">Supported dataset information</h2>
            <p className="sci mt-2 max-w-3xl text-muted">Prepared abundance tables in long-format CSV: one row per sample–feature pair. Abundances usually represent sequencing reads, not cell counts. FASTQ and other raw sequencing formats are not supported.</p>
            <div className="mt-5 overflow-x-auto rounded-xl border border-line">
              <table className="tbl mono w-full min-w-[640px] text-xs">
                <thead><tr>{['sample_id', 'feature_id', 'organism', 'taxonomic_rank', 'abundance', 'sample_group', 'lineage (optional)'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  <tr><td>S1</td><td>OTU_001</td><td>Bacteroides</td><td>genus</td><td>1520</td><td>Group A</td><td>Bacteria;Bacteroidota;…</td></tr>
                  <tr><td>S1</td><td>OTU_002</td><td>Lactobacillus</td><td>genus</td><td>310</td><td>Group A</td><td>Bacteria;Firmicutes;…</td></tr>
                </tbody>
              </table>
            </div>
          </Card>
        </Reveal>
      </section>

      <section id="faq" className="mx-auto w-[min(860px,calc(100%-32px))] scroll-mt-24 py-14">
        <Reveal><h2 className="mb-6 text-3xl font-bold">Frequently asked questions</h2></Reveal>
        <div className="space-y-3">
          {FAQ.map(([q, a], i) => (
            <Card key={q} lift={false}>
              <button className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold" onClick={() => setFaq(faq === i ? null : i)} aria-expanded={faq === i}>
                {q}<ChevronDown size={18} className={`shrink-0 transition-transform ${faq === i ? 'rotate-180' : ''}`} />
              </button>
              <div className="grid transition-all duration-300" style={{ gridTemplateRows: faq === i ? '1fr' : '0fr' }}>
                <p className="sci overflow-hidden px-5 text-sm text-muted"><span className="block pb-5">{a}</span></p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-[min(1180px,calc(100%-32px))] py-10">
        <Reveal>
          <Card lift={false} className="flex flex-wrap items-center justify-between gap-6 p-8">
            <div><h2 className="text-2xl font-bold">Advance Research with Microbiome Atlas</h2><p className="sci mt-1 text-muted">Bridging the gap between complex data and clear scientific insights.</p></div>
            <Btn variant="primary" className="!min-h-12 !px-6" onClick={start}>Get Started <ArrowRight size={16} /></Btn>
          </Card>
        </Reveal>
      </section>

      <footer className="mx-auto mt-10 w-[min(1180px,calc(100%-32px))] border-t border-line py-8 text-sm text-muted">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo size={22} />
          <p className="sci max-w-xl text-xs">For exploratory research use. Sample datasets are illustrative demos. Microbiome Atlas does not perform sequencing and does not diagnose diseases.</p>
        </div>
      </footer>
    </div>
  )
}
