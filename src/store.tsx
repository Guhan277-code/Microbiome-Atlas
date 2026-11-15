import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildMatrix, mapRecords, parseCSV, validate, type Check, type Mapping, type Matrix, type RawTable, type Rec } from './lib/science'
import { sampleCSV, SAMPLES } from './lib/samples'
import {
  supabase,
  signOutUser,
  fetchDatasets,
  upsertDataset,
  deleteDataset,
  renameDataset as renameDbDataset,
  fetchReports,
  createReport,
  fetchActivities,
  insertActivity,
  markActivitiesAsRead,
  clearActivities,
  getProfile,
  type DatasetRecord,
} from './lib/supabase'

export type ModuleId = 'composition' | 'alpha' | 'beta' | 'taxonomy' | 'comparison' | 'advanced'
export const MODULES: { id: ModuleId; label: string; desc: string; status: string }[] = [
  { id: 'composition', label: 'Composition Analysis', desc: 'Relative and raw abundance across taxonomic levels, stacked bars, heatmap and tables.', status: 'Implemented' },
  { id: 'alpha', label: 'Alpha Diversity', desc: 'Observed features, Shannon, Simpson (1 − D) and Pielou evenness per sample.', status: 'Implemented' },
  { id: 'beta', label: 'Beta Diversity', desc: 'Bray-Curtis dissimilarity matrix and PCoA ordination with computed explained variation.', status: 'Implemented' },
  { id: 'taxonomy', label: 'Taxonomic Explorer', desc: 'Lineage tree with abundance per taxon across samples and groups (needs a lineage column).', status: 'Implemented' },
  { id: 'comparison', label: 'Sample Comparison', desc: 'Side-by-side sample or group profiles, shared/unique features and Bray-Curtis between them.', status: 'Implemented' },
  { id: 'advanced', label: 'Advanced Analytics', desc: 'Descriptive fold-change and rank-correlation tables (experimental); other tools are planned.', status: 'Experimental' },
]

export interface Run {
  id: string
  at: number
  modules: ModuleId[]
}
export interface Dataset {
  id: string
  name: string
  description: string
  type: 'Sample' | 'Upload'
  fileName: string
  size: number
  uploadedAt: number
  raw: RawTable
  mapping: Mapping
  recs: Rec[]
  checks: Check[]
  M: Matrix
  done: Partial<Record<ModuleId, number>>
  runs: Run[]
  history: { t: number; text: string }[]
}
export interface Draft {
  source: 'upload' | 'sample'
  sampleKey?: string
  existingId?: string
  fileName: string
  size: number
  raw: RawTable
  mapping: Mapping
  detected: boolean
  name: string
  description: string
  modules: ModuleId[]
  maxStep: number
  reviewed: boolean
}
export interface ReportRec {
  id: string
  datasetId: string
  at: number
  title: string
  kind: string
  sections: string[]
}
export interface Note {
  id: string
  t: number
  kind: 'upload' | 'validation' | 'analysis' | 'report' | 'error' | 'info'
  text: string
  read: boolean
  datasetId?: string
}
export interface Filters {
  group: string
  sample: string
  level: string
  topN: number
  mode: 'relative' | 'raw'
  metric: 'observed' | 'shannon' | 'simpson' | 'pielou'
}
export interface Settings {
  name: string
  email: string
  topN: number
  mode: 'relative' | 'raw'
  level: string
  toasts: boolean
  notifyKinds: Record<string, boolean>
  reduceMotion: boolean
  exportFormat: 'pdf' | 'csv' | 'png' | 'svg'
  prefix: string
  decimals: number
}

export interface AppUser {
  id?: string
  name: string
  email?: string
  guest: boolean
}

const defaultSettings: Settings = {
  name: 'Guest Researcher',
  email: '',
  topN: 8,
  mode: 'relative',
  level: 'Genus',
  toasts: true,
  notifyKinds: { upload: true, validation: true, analysis: true, report: true, error: true },
  reduceMotion: false,
  exportFormat: 'pdf',
  prefix: 'microbiome-atlas',
  decimals: 3,
}

interface Ctx {
  theme: 'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
  settings: Settings
  setSettings: (p: Partial<Settings>) => void
  user: AppUser | null
  authLoading: boolean
  signIn: (name: string, guest: boolean, email?: string, id?: string) => void
  signOut: () => void
  redirectAfterAuth: string | null
  setRedirectAfterAuth: (p: string | null) => void
  datasets: Dataset[]
  active: Dataset | null
  setActive: (id: string) => void
  draft: Draft | null
  setDraft: (p: Partial<Draft> | null) => void
  loadFile: (name: string, size: number, text: string) => string | null
  loadSample: (key: string) => void
  draftFromDataset: (id: string) => void
  commit: () => string | null
  runModules: (id: string, mods: ModuleId[]) => void
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  reports: ReportRec[]
  addReport: (r: Omit<ReportRec, 'id' | 'at'>) => void
  notes: Note[]
  notify: (kind: Note['kind'], text: string, datasetId?: string) => void
  markRead: () => void
  clearNotes: () => void
  toast: Note | null
  filters: Filters
  setFilters: (p: Partial<Filters>) => void
  organism: string | null
  setOrganism: (o: string | null) => void
  path: string
  go: (p: string) => void
}
const C = createContext<Ctx>(null as never)
export const useApp = () => useContext(C)

let seq = 0
const uid = () => Date.now().toString(36) + (seq++).toString(36)
const dsId = () => 'MA-' + (Date.now() % 1679616).toString(36).toUpperCase().padStart(4, '0') + (seq++ % 36).toString(36).toUpperCase()

function readPath() {
  return location.hash.replace(/^#/, '') || '/'
}

export function Provider({ children }: { children: ReactNode }) {
  const [theme, setThemeS] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('ma-theme') as 'dark' | 'light') || 'dark'
    } catch {
      return 'dark'
    }
  })
  const [settings, setSettingsS] = useState(defaultSettings)
  const [user, setUser] = useState<AppUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [redirectAfterAuth, setRedirectAfterAuth] = useState<string | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraftS] = useState<Draft | null>(null)
  const [reports, setReports] = useState<ReportRec[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [toast, setToast] = useState<Note | null>(null)
  const [organism, setOrganism] = useState<string | null>(null)
  const [path, setPath] = useState(readPath())
  const mkFilters = (s: Settings): Filters => ({ group: 'all', sample: 'all', level: s.level, topN: s.topN, mode: s.mode, metric: 'shannon' })
  const [filters, setFiltersS] = useState<Filters>(mkFilters(defaultSettings))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('ma-theme', theme)
    } catch {
      /* storage unavailable: theme lasts for the session */
    }
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion)
  }, [settings.reduceMotion])

  useEffect(() => {
    const h = () => {
      setPath(readPath())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])

  // global cursor-follow glow: each .glow element tracks its own pointer position
  useEffect(() => {
    const mv = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('.glow') as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', e.clientX - r.left + 'px')
      el.style.setProperty('--my', e.clientY - r.top + 'px')
    }
    document.addEventListener('pointermove', mv, { passive: true })
    document.addEventListener('pointerdown', mv, { passive: true })
    return () => {
      document.removeEventListener('pointermove', mv)
      document.removeEventListener('pointerdown', mv)
    }
  }, [])

  // Reconstitute Dataset from database record
  const recordToDataset = useCallback((rec: DatasetRecord): Dataset => {
    const recs = mapRecords(rec.raw_data, rec.mapping)
    const checks = validate(rec.raw_data, rec.mapping, recs)
    const M = buildMatrix(recs)
    return {
      id: rec.id,
      name: rec.name,
      description: rec.description || '',
      type: rec.type,
      fileName: rec.file_name,
      size: rec.size,
      uploadedAt: rec.uploaded_at,
      raw: rec.raw_data,
      mapping: rec.mapping,
      recs,
      checks,
      M,
      done: (rec.done || {}) as Record<ModuleId, number>,
      runs: [],
      history: [
        { t: rec.uploaded_at, text: `Loaded from database: ${rec.name}` },
      ],
    }
  }, [])

  // Load user data from Supabase
  const loadUserData = useCallback(async (userId: string) => {
    try {
      // 1. Fetch profile settings
      const profile = await getProfile(userId)
      if (profile) {
        setSettingsS((s) => ({
          ...s,
          name: profile.display_name || s.name,
          email: profile.email || s.email,
          ...(profile.settings as Partial<Settings> || {}),
        }))
      }

      // 2. Fetch datasets
      const dbDatasets = await fetchDatasets(userId)
      if (dbDatasets.length > 0) {
        const loaded = dbDatasets.map(recordToDataset)
        setDatasets(loaded)
        setActiveId(loaded[0].id)
      }

      // 3. Fetch reports
      const dbReports = await fetchReports(userId)
      if (dbReports.length > 0) {
        setReports(
          dbReports.map((r) => ({
            id: r.id,
            datasetId: r.dataset_id,
            title: r.title,
            kind: r.kind,
            sections: r.sections,
            at: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
          })),
        )
      }

      // 4. Fetch activity logs
      const dbLogs = await fetchActivities(userId)
      if (dbLogs.length > 0) {
        setNotes(
          dbLogs.map((l) => ({
            id: l.id,
            t: l.created_at ? new Date(l.created_at).getTime() : Date.now(),
            kind: l.kind,
            text: l.text,
            read: l.read,
            datasetId: l.dataset_id || undefined,
          })),
        )
      }
    } catch (e) {
      console.error('Error synchronizing user data from Supabase:', e)
    }
  }, [recordToDataset])

  // Supabase Auth listener & Session initialization
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        const displayName = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Researcher'
        setUser({
          id: session.user.id,
          name: displayName,
          email: session.user.email,
          guest: false,
        })
        setSettingsS((s) => ({ ...s, name: displayName, email: session.user.email || s.email }))
        loadUserData(session.user.id)
      }
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN' && session?.user) {
        const displayName = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Researcher'
        setUser({
          id: session.user.id,
          name: displayName,
          email: session.user.email,
          guest: false,
        })
        setSettingsS((s) => ({ ...s, name: displayName, email: session.user.email || s.email }))
        loadUserData(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setDatasets([])
        setReports([])
        setNotes([])
        setActiveId(null)
      }
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadUserData])

  const go = useCallback((p: string) => {
    if (readPath() === p) setPath(p)
    else location.hash = p
  }, [])

  const active = datasets.find((d) => d.id === activeId) ?? null

  const setActive = useCallback((id: string) => {
    setActiveId(id)
    setOrganism(null)
    setFiltersS((f) => ({ ...mkFilters(settings), metric: f.metric }))
  }, [settings])

  const notify = useCallback<Ctx['notify']>(
    (kind, text, datasetId) => {
      const n: Note = { id: uid(), t: Date.now(), kind, text, read: false, datasetId }
      setNotes((x) => [n, ...x])
      if (settings.toasts && (kind === 'info' || settings.notifyKinds[kind])) {
        setToast(n)
        setTimeout(() => setToast((t) => (t?.id === n.id ? null : t)), 4000)
      }
      // Persist to Supabase if authenticated
      if (user?.id && !user.guest) {
        insertActivity({
          id: n.id,
          user_id: user.id,
          dataset_id: datasetId ?? null,
          kind,
          text,
          read: false,
        }).catch((err) => console.warn('Activity sync notice:', err))
      }
    },
    [settings.toasts, settings.notifyKinds, user],
  )

  const loadFile = useCallback<Ctx['loadFile']>((name, size, text) => {
    const raw = parseCSV(text)
    if (raw.headers.length < 2 || raw.rows.length === 0) return 'The file could not be read as a CSV with a header row and at least one data row.'
    const mapping = detectMappingSafe(raw)
    setDraftS({ source: 'upload', fileName: name, size, raw, mapping, detected: true, name: name.replace(/\.csv$/i, ''), description: '', modules: MODULES.slice(0, 5).map((m) => m.id), maxStep: 1, reviewed: false })
    return null
  }, [])

  const loadSample = useCallback((key: string) => {
    const def = SAMPLES.find((s) => s.key === key)!
    const text = sampleCSV(def)
    const raw = parseCSV(text)
    setDraftS({ source: 'sample', sampleKey: key, fileName: `${key}_demo.csv`, size: text.length, raw, mapping: detectMappingSafe(raw), detected: true, name: def.name, description: def.description, modules: MODULES.slice(0, 5).map((m) => m.id), maxStep: 1, reviewed: false })
  }, [])

  const setDraft = useCallback<Ctx['setDraft']>((p) => setDraftS((d) => (p === null ? null : d ? { ...d, ...p } : d)), [])

  const draftFromDataset = useCallback(
    (id: string) => {
      const d = datasets.find((x) => x.id === id)
      if (!d) return
      setDraftS({ source: d.type === 'Sample' ? 'sample' : 'upload', existingId: id, fileName: d.fileName, size: d.size, raw: d.raw, mapping: d.mapping, detected: false, name: d.name, description: d.description, modules: MODULES.slice(0, 5).map((m) => m.id), maxStep: 4, reviewed: true })
    },
    [datasets],
  )

  const runModules = useCallback<Ctx['runModules']>((id, mods) => {
    const at = Date.now()
    setDatasets((ds) =>
      ds.map((d) => {
        if (d.id !== id) return d
        const done = { ...d.done }
        mods.forEach((m) => (done[m] = at))
        const updated = {
          ...d,
          done,
          runs: [{ id: uid(), at, modules: mods }, ...d.runs],
          history: [{ t: at, text: `Analysis run: ${mods.map((m) => MODULES.find((x) => x.id === m)!.label).join(', ')}` }, ...d.history],
        }
        // Sync analysis run with Supabase
        if (user?.id && !user.guest) {
          upsertDataset({
            id: updated.id,
            user_id: user.id,
            name: updated.name,
            description: updated.description,
            type: updated.type,
            file_name: updated.fileName,
            size: updated.size,
            raw_data: updated.raw,
            mapping: updated.mapping as Record<string, string>,
            done: updated.done as Record<string, number>,
            uploaded_at: updated.uploadedAt,
          }).catch((err) => console.warn('Could not sync analysis run:', err))
        }
        return updated
      }),
    )
  }, [user])

  const commit = useCallback((): string | null => {
    if (!draft) return null
    const recs = mapRecords(draft.raw, draft.mapping)
    const checks = validate(draft.raw, draft.mapping, recs)
    if (checks.some((c) => c.status === 'error')) return null
    if (draft.existingId) {
      setDatasets((ds) => ds.map((d) => (d.id === draft.existingId ? { ...d, name: draft.name, description: draft.description } : d)))
      if (user?.id && !user.guest) {
        renameDbDataset(draft.existingId, draft.name).catch((err) => console.warn('Could not rename dataset in db:', err))
      }
      return draft.existingId
    }
    const now = Date.now()
    const d: Dataset = {
      id: dsId(),
      name: draft.name || draft.fileName,
      description: draft.description,
      type: draft.source === 'sample' ? 'Sample' : 'Upload',
      fileName: draft.fileName,
      size: draft.size,
      uploadedAt: now,
      raw: draft.raw,
      mapping: draft.mapping,
      recs,
      checks,
      M: buildMatrix(recs),
      done: {},
      runs: [],
      history: [
        { t: now, text: draft.source === 'sample' ? 'Demo dataset loaded' : `File uploaded: ${draft.fileName}` },
        { t: now, text: `Validated: ${checks.filter((c) => c.status === 'warn').length} warning(s), 0 errors` },
      ],
    }
    setDatasets((x) => [d, ...x])
    setActiveId(d.id)
    setFiltersS(mkFilters(settings))

    // Persist dataset to Supabase
    if (user?.id && !user.guest) {
      upsertDataset({
        id: d.id,
        user_id: user.id,
        name: d.name,
        description: d.description,
        type: d.type,
        file_name: d.fileName,
        size: d.size,
        raw_data: d.raw,
        mapping: d.mapping as Record<string, string>,
        done: d.done as Record<string, number>,
        uploaded_at: d.uploadedAt,
      }).catch((err) => console.warn('Could not persist dataset to Supabase:', err))
    }

    return d.id
  }, [draft, settings, user])

  const rename = useCallback((id: string, name: string) => {
    setDatasets((ds) => ds.map((d) => (d.id === id ? { ...d, name, history: [{ t: Date.now(), text: `Renamed to "${name}"` }, ...d.history] } : d)))
    if (user?.id && !user.guest) {
      renameDbDataset(id, name).catch((err) => console.warn('Could not rename dataset in Supabase:', err))
    }
  }, [user])

  const remove = useCallback(
    (id: string) => {
      setDatasets((ds) => ds.filter((d) => d.id !== id))
      setReports((r) => r.filter((x) => x.datasetId !== id))
      if (activeId === id) setActiveId(datasets.find((d) => d.id !== id)?.id ?? null)
      if (user?.id && !user.guest) {
        deleteDataset(id).catch((err) => console.warn('Could not delete dataset in Supabase:', err))
      }
    },
    [activeId, datasets, user],
  )

  const addReport = useCallback<Ctx['addReport']>((r) => {
    const reportRec: ReportRec = { ...r, id: uid(), at: Date.now() }
    setReports((x) => [reportRec, ...x])
    if (user?.id && !user.guest) {
      createReport({
        id: reportRec.id,
        dataset_id: reportRec.datasetId,
        user_id: user.id,
        title: reportRec.title,
        kind: reportRec.kind,
        sections: reportRec.sections,
      }).catch((err) => console.warn('Could not persist report to Supabase:', err))
    }
  }, [user])

  const value = useMemo<Ctx>(
    () => ({
      theme,
      setTheme: setThemeS,
      settings,
      setSettings: (p) => {
        setSettingsS((s) => ({ ...s, ...p }))
        setFiltersS((f) => ({ ...f, ...(p.topN ? { topN: p.topN } : {}), ...(p.mode ? { mode: p.mode } : {}), ...(p.level ? { level: p.level } : {}) }))
      },
      user,
      authLoading,
      signIn: (name, guest, email, id) => setUser({ name, guest, email, id }),
      signOut: async () => {
        try {
          await signOutUser()
        } catch (e) {
          console.warn('Sign out notice:', e)
        }
        setUser(null)
        setDatasets([])
        setReports([])
        setNotes([])
        go('/')
      },
      redirectAfterAuth,
      setRedirectAfterAuth,
      datasets,
      active,
      setActive,
      draft,
      setDraft,
      loadFile,
      loadSample,
      draftFromDataset,
      commit,
      runModules,
      rename,
      remove,
      reports,
      addReport,
      notes,
      notify,
      markRead: () => {
        setNotes((n) => n.map((x) => ({ ...x, read: true })))
        if (user?.id && !user.guest) {
          markActivitiesAsRead(user.id)
        }
      },
      clearNotes: () => {
        setNotes([])
        if (user?.id && !user.guest) {
          clearActivities(user.id)
        }
      },
      toast,
      filters,
      setFilters: (p) => setFiltersS((f) => ({ ...f, ...p })),
      organism,
      setOrganism,
      path,
      go,
    }),
    [theme, settings, user, authLoading, redirectAfterAuth, datasets, active, setActive, draft, setDraft, loadFile, loadSample, draftFromDataset, commit, runModules, rename, remove, reports, addReport, notes, notify, toast, filters, organism, path, go],
  )
  return <C.Provider value={value}>{children}</C.Provider>
}

import { detectMapping } from './lib/science'
function detectMappingSafe(raw: RawTable) {
  return detectMapping(raw.headers)
}
