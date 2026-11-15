import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { MAX_CSV_ROWS, buildMatrix, mapRecords, parseCSV, validate, type Check, type Mapping, type Matrix, type RawTable, type Rec } from './lib/science'
import { sampleCSV, SAMPLES } from './lib/samples'
import {
  supabase,
  signOutUser,
  fetchDatasets,
  upsertDataset,
  updateDatasetDone,
  updateDatasetDetails,
  deleteDataset,
  renameDataset as renameDbDataset,
  fetchReports,
  createReport,
  fetchActivities,
  insertActivity,
  markActivitiesAsRead,
  clearActivities,
  getProfile,
  upsertProfile,
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
  saveSettings: (override?: Partial<Settings>) => Promise<boolean>
  user: AppUser | null
  authLoading: boolean
  dataLoading: boolean
  dataError: string | null
  hydratedUserId: string | null
  recoveryMode: boolean
  clearRecoveryMode: () => void
  retrySync: () => Promise<void>
  signIn: (name: string, guest: boolean, email?: string, id?: string) => void
  signOut: () => Promise<void>
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
  commit: () => Promise<string | null>
  runModules: (id: string, mods: ModuleId[]) => Promise<boolean>
  rename: (id: string, name: string) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
  reports: ReportRec[]
  addReport: (r: Omit<ReportRec, 'id' | 'at'>) => Promise<ReportRec | null>
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
function randomToken(len = 8): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, len).toUpperCase()
  }
  seq += 1
  return `${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase().slice(0, len)
}
const uid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const dsId = () => `MA-${randomToken(8)}`

const VALID_MODULE_IDS = new Set<ModuleId>(MODULES.map((m) => m.id))
const MODULE_ORDER = new Map(MODULES.map((m, idx) => [m.id, idx]))

function reconstructRuns(
  doneRaw: Record<string, unknown> | null | undefined,
  datasetId: string,
): { done: Partial<Record<ModuleId, number>>; runs: Run[] } {
  const done: Partial<Record<ModuleId, number>> = {}
  const byTimestamp = new Map<number, ModuleId[]>()

  if (doneRaw && typeof doneRaw === 'object') {
    for (const [key, value] of Object.entries(doneRaw)) {
      if (!VALID_MODULE_IDS.has(key as ModuleId)) continue
      const ts = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
      if (ts === null) continue
      const mod = key as ModuleId
      done[mod] = ts
      const group = byTimestamp.get(ts) ?? []
      group.push(mod)
      byTimestamp.set(ts, group)
    }
  }

  const runs: Run[] = Array.from(byTimestamp.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([at, modules]) => ({
      id: `run-${datasetId}-${at}`,
      at,
      modules: [...modules].sort((a, b) => (MODULE_ORDER.get(a) ?? 99) - (MODULE_ORDER.get(b) ?? 99)),
    }))

  return { done, runs }
}

function persistedPrefs(s: Settings) {
  return {
    topN: s.topN,
    mode: s.mode,
    level: s.level,
    toasts: s.toasts,
    notifyKinds: s.notifyKinds,
    reduceMotion: s.reduceMotion,
    exportFormat: s.exportFormat,
    prefix: s.prefix,
    decimals: s.decimals,
  }
}

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
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null)
  const [recoveryMode, setRecoveryMode] = useState(false)
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

  const mountedRef = useRef(true)
  const userRef = useRef<AppUser | null>(user)
  const datasetsRef = useRef<Dataset[]>(datasets)
  const activeIdRef = useRef<string | null>(activeId)
  const settingsRef = useRef<Settings>(settings)
  const expectedUserIdRef = useRef<string | null>(null)
  const loadedUserRef = useRef<string | null>(null)
  const inFlightLoadRef = useRef<{ userId: string; promise: Promise<void> } | null>(null)
  const prefsSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  userRef.current = user
  datasetsRef.current = datasets
  activeIdRef.current = activeId
  settingsRef.current = settings

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (prefsSyncTimerRef.current) clearTimeout(prefsSyncTimerRef.current)
    }
  }, [])

  const resetSessionState = useCallback(() => {
    expectedUserIdRef.current = null
    loadedUserRef.current = null
    inFlightLoadRef.current = null
    if (prefsSyncTimerRef.current) {
      clearTimeout(prefsSyncTimerRef.current)
      prefsSyncTimerRef.current = null
    }
    setUser(null)
    setDataLoading(false)
    setDataError(null)
    setHydratedUserId(null)
    setRecoveryMode(false)
    setDatasets([])
    setActiveId(null)
    setDraftS(null)
    setReports([])
    setNotes([])
    setOrganism(null)
    setSettingsS(defaultSettings)
    setFiltersS(mkFilters(defaultSettings))
  }, [])

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

  // Reconstitute Dataset from database record
  const recordToDataset = useCallback((rec: DatasetRecord): Dataset => {
    const raw: RawTable =
      rec.raw_data && Array.isArray(rec.raw_data.headers) && Array.isArray(rec.raw_data.rows)
        ? rec.raw_data
        : { headers: [], rows: [] }
    const mapping = (rec.mapping && typeof rec.mapping === 'object' ? rec.mapping : {}) as Mapping
    const recs = mapRecords(raw, mapping)
    const checks = validate(raw, mapping, recs)
    const M = buildMatrix(recs)
    const { done, runs } = reconstructRuns(rec.done, rec.id)
    const runHistory = runs.map((r) => ({
      t: r.at,
      text: `Analysis run: ${r.modules.map((m) => MODULES.find((x) => x.id === m)?.label ?? m).join(', ')}`,
    }))
    return {
      id: rec.id,
      name: rec.name,
      description: rec.description || '',
      type: rec.type,
      fileName: rec.file_name,
      size: rec.size,
      uploadedAt: rec.uploaded_at,
      raw,
      mapping,
      recs,
      checks,
      M,
      done,
      runs,
      history: [
        ...runHistory,
        { t: rec.uploaded_at, text: `Loaded from database: ${rec.name}` },
      ],
    }
  }, [])

  // Load user data from Supabase (deduplicated per user session)
  const loadUserData = useCallback(
    async (userId: string, opts?: { force?: boolean; fallbackName?: string; fallbackEmail?: string }) => {
      if (!opts?.force && loadedUserRef.current === userId) return
      if (!opts?.force && inFlightLoadRef.current?.userId === userId) {
        return inFlightLoadRef.current.promise
      }

      const task = (async () => {
        expectedUserIdRef.current = userId
        if (mountedRef.current) {
          setDataLoading(true)
          setDataError(null)
        }
        try {
          const [profile, dbDatasets, dbReports, dbLogs] = await Promise.all([
            getProfile(userId),
            fetchDatasets(userId),
            fetchReports(userId),
            fetchActivities(userId),
          ])

          if (!mountedRef.current || expectedUserIdRef.current !== userId) return

          const rawPrefs =
            profile?.settings && typeof profile.settings === 'object'
              ? (profile.settings as Partial<Settings>)
              : {}
          const mergedSettings: Settings = {
            ...defaultSettings,
            ...rawPrefs,
            notifyKinds: {
              ...defaultSettings.notifyKinds,
              ...(rawPrefs.notifyKinds && typeof rawPrefs.notifyKinds === 'object' ? rawPrefs.notifyKinds : {}),
            },
            name: profile?.display_name || opts?.fallbackName || userRef.current?.name || defaultSettings.name,
            email: profile?.email || opts?.fallbackEmail || userRef.current?.email || defaultSettings.email,
          }
          setSettingsS(mergedSettings)
          setFiltersS(mkFilters(mergedSettings))
          if (profile?.display_name || profile?.email) {
            setUser((u) =>
              u && u.id === userId
                ? {
                    ...u,
                    name: profile.display_name || u.name,
                    email: profile.email || u.email,
                  }
                : u,
            )
          }

          const loadedDatasets = dbDatasets.map(recordToDataset)
          setDatasets(loadedDatasets)
          setActiveId((prev) => (prev && loadedDatasets.some((d) => d.id === prev) ? prev : loadedDatasets[0]?.id ?? null))

          setReports(
            dbReports.map((r) => ({
              id: r.id,
              datasetId: r.dataset_id,
              title: r.title,
              kind: r.kind,
              sections: Array.isArray(r.sections) ? r.sections : [],
              at: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
            })),
          )

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

          loadedUserRef.current = userId
          setHydratedUserId(userId)
        } catch (e: unknown) {
          if (!mountedRef.current || expectedUserIdRef.current !== userId) return
          const msg = e instanceof Error ? e.message : 'Failed to synchronize account data from Supabase.'
          setDataError(msg)
          console.error('Error synchronizing user data from Supabase:', e)
        } finally {
          if (inFlightLoadRef.current?.userId === userId) {
            inFlightLoadRef.current = null
          }
          if (mountedRef.current && expectedUserIdRef.current === userId) {
            setDataLoading(false)
          }
        }
      })()

      inFlightLoadRef.current = { userId, promise: task }
      return task
    },
    [recordToDataset],
  )

  const retrySync = useCallback(async () => {
    const current = userRef.current
    if (!current?.id || current.guest) return
    await loadUserData(current.id, { force: true, fallbackName: current.name, fallbackEmail: current.email })
  }, [loadUserData])

  // Supabase Auth listener & Session initialization
  useEffect(() => {
    let mounted = true

    if (!supabase) {
      setAuthLoading(false)
      return
    }

    const handleSession = (session: Session | null, event?: string) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
      }

      if (session?.user) {
        const displayName =
          (session.user.user_metadata?.display_name as string | undefined) ||
          session.user.email?.split('@')[0] ||
          'Researcher'
        const sameLoadedUser = loadedUserRef.current === session.user.id
        expectedUserIdRef.current = session.user.id
        setUser({
          id: session.user.id,
          name: displayName,
          email: session.user.email,
          guest: false,
        })
        if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
          setSettingsS((s) => ({ ...s, name: displayName, email: session.user.email || s.email }))
          if (sameLoadedUser) {
            setAuthLoading(false)
            return
          }
        }
        if (!sameLoadedUser) {
          setSettingsS((s) => ({ ...s, name: displayName, email: session.user.email || s.email }))
          setDataLoading(true)
          void loadUserData(session.user.id, { fallbackName: displayName, fallbackEmail: session.user.email })
        }
      } else if (event === 'SIGNED_OUT' || !userRef.current?.guest) {
        resetSessionState()
      }
      setAuthLoading(false)
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        handleSession(session)
      })
      .catch((err) => {
        console.warn('Could not read initial Supabase session:', err)
        if (mounted) setAuthLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleSession(session, event)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadUserData, resetSessionState])

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
    if (raw.unclosedQuote) return 'The CSV file contains an unclosed quotation mark. Fix the quote formatting and upload again.'
    if (raw.truncatedAtLimit) return `The CSV exceeds the maximum supported limit of ${MAX_CSV_ROWS.toLocaleString()} rows.`
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

  const runModules = useCallback<Ctx['runModules']>(
    async (id, mods) => {
      const target = datasetsRef.current.find((d) => d.id === id)
      if (!target || mods.length === 0) return false
      const at = Date.now()
      const done: Partial<Record<ModuleId, number>> = { ...target.done }
      mods.forEach((m) => (done[m] = at))
      const currentUser = userRef.current
      if (currentUser?.id && !currentUser.guest) {
        try {
          await updateDatasetDone(target.id, currentUser.id, done as Record<string, number>)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not save analysis run to Supabase.'
          notify('error', `Could not save analysis run: ${msg}`, target.id)
          return false
        }
      }
      setDatasets((ds) =>
        ds.map((d) => {
          if (d.id !== id) return d
          return {
            ...d,
            done,
            runs: [{ id: uid(), at, modules: mods }, ...d.runs],
            history: [
              { t: at, text: `Analysis run: ${mods.map((m) => MODULES.find((x) => x.id === m)?.label ?? m).join(', ')}` },
              ...d.history,
            ],
          }
        }),
      )
      return true
    },
    [notify],
  )

  const commit = useCallback(async (): Promise<string | null> => {
    if (!draft) return null
    const recs = mapRecords(draft.raw, draft.mapping)
    const checks = validate(draft.raw, draft.mapping, recs)
    if (checks.some((c) => c.status === 'error')) return null
    const currentUser = userRef.current
    if (draft.existingId) {
      const existing = datasetsRef.current.find((d) => d.id === draft.existingId)
      const nextName = draft.name.trim() || existing?.name || draft.fileName
      const nextDesc = draft.description
      if (
        currentUser?.id &&
        !currentUser.guest &&
        existing &&
        (nextName !== existing.name || nextDesc !== existing.description)
      ) {
        try {
          await updateDatasetDetails(draft.existingId, currentUser.id, nextName, nextDesc)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not update dataset details.'
          notify('error', `Could not update dataset details: ${msg}`, draft.existingId)
          return null
        }
      }
      setDatasets((ds) =>
        ds.map((d) =>
          d.id === draft.existingId
            ? {
                ...d,
                name: nextName,
                description: nextDesc,
                history:
                  nextName !== d.name || nextDesc !== d.description
                    ? [{ t: Date.now(), text: 'Updated dataset details' }, ...d.history]
                    : d.history,
              }
            : d,
        ),
      )
      return draft.existingId
    }
    const now = Date.now()
    const d: Dataset = {
      id: dsId(),
      name: draft.name.trim() || draft.fileName,
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

    if (currentUser?.id && !currentUser.guest) {
      try {
        await upsertDataset({
          id: d.id,
          user_id: currentUser.id,
          name: d.name,
          description: d.description,
          type: d.type,
          file_name: d.fileName,
          size: d.size,
          raw_data: d.raw,
          mapping: d.mapping as Record<string, string>,
          done: d.done as Record<string, number>,
          uploaded_at: d.uploadedAt,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save dataset to Supabase.'
        notify('error', `Could not save dataset: ${msg}`)
        return null
      }
    }

    setDatasets((x) => [d, ...x])
    setActiveId(d.id)
    setFiltersS(mkFilters(settingsRef.current))
    return d.id
  }, [draft, notify])

  const rename = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      const trimmed = name.trim()
      if (!trimmed) return false
      const currentUser = userRef.current
      if (currentUser?.id && !currentUser.guest) {
        try {
          await renameDbDataset(id, currentUser.id, trimmed)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not rename dataset.'
          notify('error', `Could not rename dataset: ${msg}`, id)
          return false
        }
      }
      setDatasets((ds) =>
        ds.map((d) =>
          d.id === id
            ? { ...d, name: trimmed, history: [{ t: Date.now(), text: `Renamed to "${trimmed}"` }, ...d.history] }
            : d,
        ),
      )
      return true
    },
    [notify],
  )

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const currentUser = userRef.current
      if (currentUser?.id && !currentUser.guest) {
        try {
          await deleteDataset(id, currentUser.id)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not delete dataset.'
          notify('error', `Could not delete dataset: ${msg}`, id)
          return false
        }
      }
      const remaining = datasetsRef.current.filter((d) => d.id !== id)
      setDatasets((ds) => ds.filter((d) => d.id !== id))
      setReports((r) => r.filter((x) => x.datasetId !== id))
      if (activeIdRef.current === id) {
        setActiveId(remaining[0]?.id ?? null)
      }
      return true
    },
    [notify],
  )

  const addReport = useCallback<Ctx['addReport']>(
    async (r) => {
      const reportRec: ReportRec = { ...r, id: uid(), at: Date.now() }
      const currentUser = userRef.current
      if (currentUser?.id && !currentUser.guest) {
        try {
          await createReport({
            id: reportRec.id,
            dataset_id: reportRec.datasetId,
            user_id: currentUser.id,
            title: reportRec.title,
            kind: reportRec.kind,
            sections: reportRec.sections,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not save report.'
          notify('error', `Could not save report: ${msg}`, reportRec.datasetId)
          return null
        }
      }
      setReports((x) => [reportRec, ...x])
      return reportRec
    },
    [notify],
  )

  const saveSettings = useCallback(
    async (override?: Partial<Settings>): Promise<boolean> => {
      const next: Settings = { ...settingsRef.current, ...(override || {}) }
      settingsRef.current = next
      setSettingsS(next)
      setFiltersS((f) => ({ ...f, topN: next.topN, mode: next.mode, level: next.level }))
      const currentUser = userRef.current
      if (!currentUser?.id || currentUser.guest) return true
      if (prefsSyncTimerRef.current) {
        clearTimeout(prefsSyncTimerRef.current)
        prefsSyncTimerRef.current = null
      }
      const displayName = next.name.trim() || currentUser.name
      try {
        await upsertProfile({
          id: currentUser.id,
          display_name: displayName,
          email: next.email || currentUser.email || null,
          settings: persistedPrefs(next),
        })
        setUser((u) => (u && u.id === currentUser.id ? { ...u, name: displayName } : u))
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update profile.'
        notify('error', `Error saving profile: ${msg}`)
        return false
      }
    },
    [notify],
  )

  const setSettings = useCallback<Ctx['setSettings']>((p) => {
    const next: Settings = { ...settingsRef.current, ...p }
    settingsRef.current = next
    setSettingsS(next)
    setFiltersS((f) => ({
      ...f,
      ...(p.topN !== undefined ? { topN: p.topN } : {}),
      ...(p.mode !== undefined ? { mode: p.mode } : {}),
      ...(p.level !== undefined ? { level: p.level } : {}),
    }))

    const touchesPrefs = Object.keys(p).some((k) => k !== 'name' && k !== 'email')
    const currentUser = userRef.current
    if (touchesPrefs && currentUser?.id && !currentUser.guest) {
      if (prefsSyncTimerRef.current) clearTimeout(prefsSyncTimerRef.current)
      prefsSyncTimerRef.current = setTimeout(() => {
        const latestUser = userRef.current
        const latestSettings = settingsRef.current
        if (!latestUser?.id || latestUser.guest) return
        upsertProfile({
          id: latestUser.id,
          display_name: latestUser.name,
          email: latestUser.email || null,
          settings: persistedPrefs(latestSettings),
        }).catch((err) => console.warn('Preference sync notice:', err))
      }, 600)
    }
  }, [])

  const clearRecoveryMode = useCallback(() => setRecoveryMode(false), [])

  const value = useMemo<Ctx>(
    () => ({
      theme,
      setTheme: setThemeS,
      settings,
      setSettings,
      saveSettings,
      user,
      authLoading,
      dataLoading,
      dataError,
      hydratedUserId,
      recoveryMode,
      clearRecoveryMode,
      retrySync,
      signIn: (name, guest, email, id) => {
        if (guest) {
          resetSessionState()
          setUser({ name, guest: true, email })
          setSettingsS({ ...defaultSettings, name, email: email || '' })
          return
        }
        expectedUserIdRef.current = id ?? null
        setUser({ name, guest: false, email, id })
        if (id && loadedUserRef.current !== id) {
          setDataLoading(true)
          void loadUserData(id, { fallbackName: name, fallbackEmail: email })
        }
      },
      signOut: async () => {
        try {
          await signOutUser()
        } catch (e) {
          console.warn('Sign out notice:', e)
        } finally {
          resetSessionState()
          go('/')
        }
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
        const currentUser = userRef.current
        if (currentUser?.id && !currentUser.guest) {
          markActivitiesAsRead(currentUser.id).catch((err) => console.warn('Activity read notice:', err))
        }
      },
      clearNotes: () => {
        setNotes([])
        const currentUser = userRef.current
        if (currentUser?.id && !currentUser.guest) {
          clearActivities(currentUser.id).catch((err) => console.warn('Activity clear notice:', err))
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
    [
      theme,
      settings,
      setSettings,
      saveSettings,
      user,
      authLoading,
      dataLoading,
      dataError,
      hydratedUserId,
      recoveryMode,
      clearRecoveryMode,
      retrySync,
      resetSessionState,
      loadUserData,
      redirectAfterAuth,
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
      toast,
      filters,
      organism,
      path,
      go,
    ],
  )
  return <C.Provider value={value}>{children}</C.Provider>
}

import { detectMapping } from './lib/science'
function detectMappingSafe(raw: RawTable) {
  return detectMapping(raw.headers)
}
