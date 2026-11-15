import { createClient, type SupabaseClient, type User, type Session } from '@supabase/supabase-js'

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const rawKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ?? ''

const PLACEHOLDER_URLS = new Set(['https://your-project.supabase.co'])
const PLACEHOLDER_KEYS = new Set(['sb_publishable_your_publishable_key'])

function validateConfig(url: string, key: string): string | null {
  if (!url || !key) {
    return 'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.'
  }
  if (PLACEHOLDER_URLS.has(url) || PLACEHOLDER_KEYS.has(key)) {
    return 'Supabase configuration still uses placeholder values from .env.example. Update .env.local with your project credentials.'
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'VITE_SUPABASE_URL must be an http:// or https:// URL.'
    }
  } catch {
    return 'VITE_SUPABASE_URL is not a valid URL.'
  }
  return null
}

export const supabaseConfigError = validateConfig(rawUrl, rawKey)
export const isSupabaseConfigured = supabaseConfigError === null

if (supabaseConfigError) {
  console.warn(supabaseConfigError)
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  : null

function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(supabaseConfigError || 'Supabase client is not configured.')
  }
  return supabase
}

export interface ProfileRecord {
  id: string
  display_name: string | null
  email: string | null
  avatar_url?: string | null
  settings?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

export interface DatasetRecord {
  id: string
  user_id: string
  name: string
  description?: string
  type: 'Sample' | 'Upload'
  file_name: string
  size: number
  raw_data: { headers: string[]; rows: string[][] }
  mapping: Record<string, string>
  done: Record<string, number>
  uploaded_at: number
  created_at?: string
  updated_at?: string
}

export interface ReportRecord {
  id: string
  dataset_id: string
  user_id: string
  title: string
  kind: string
  sections: string[]
  created_at?: string
}

export interface ActivityRecord {
  id: string
  user_id: string
  dataset_id?: string | null
  kind: 'upload' | 'validation' | 'analysis' | 'report' | 'error' | 'info'
  text: string
  read: boolean
  created_at?: string
}

// ==================== AUTHENTICATION HELPERS ====================

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      data: {
        display_name: displayName || email.split('@')[0],
      },
    },
  })
  if (error) throw error

  // If user is created and session is returned, ensure profile exists
  if (data.user && data.session) {
    try {
      await upsertProfile({
        id: data.user.id,
        email: data.user.email ?? email,
        display_name: displayName || email.split('@')[0],
      })
    } catch (e) {
      console.warn('Profile auto-creation non-blocking notice:', e)
    }
  }

  return data
}

export async function signInWithEmail(email: string, password: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOutUser() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function resetPassword(email: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
  })
  if (error) throw error
  return data
}

export async function updateUserPassword(newPassword: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.updateUser({ password: newPassword })
  if (error) throw error
  return data
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ==================== PROFILES ====================

export async function getProfile(userId: string): Promise<ProfileRecord | null> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function upsertProfile(profile: Partial<ProfileRecord> & { id: string }) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('profiles')
    .upsert({
      ...profile,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ==================== DATASETS ====================

export async function fetchDatasets(userId: string): Promise<DatasetRecord[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('datasets')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function upsertDataset(record: DatasetRecord) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('datasets')
    .upsert({
      id: record.id,
      user_id: record.user_id,
      name: record.name,
      description: record.description ?? '',
      type: record.type,
      file_name: record.file_name,
      size: record.size,
      raw_data: record.raw_data,
      mapping: record.mapping,
      done: record.done,
      uploaded_at: record.uploaded_at,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateDatasetDone(id: string, userId: string, done: Record<string, number>) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('datasets')
    .update({ done, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function updateDatasetDetails(id: string, userId: string, name: string, description: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('datasets')
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function deleteDataset(id: string, userId: string) {
  const client = requireSupabase()
  const { error } = await client
    .from('datasets')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}

export async function renameDataset(id: string, userId: string, name: string) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('datasets')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .single()

  if (error) throw error
  return data
}

// ==================== REPORTS ====================

export async function fetchReports(userId: string): Promise<ReportRecord[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createReport(record: ReportRecord) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('reports')
    .insert({
      id: record.id,
      dataset_id: record.dataset_id,
      user_id: record.user_id,
      title: record.title,
      kind: record.kind,
      sections: record.sections,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ==================== ACTIVITY LOGS ====================

export async function fetchActivities(userId: string): Promise<ActivityRecord[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data || []
}

export async function insertActivity(record: ActivityRecord) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('activity_logs')
    .insert({
      id: record.id,
      user_id: record.user_id,
      dataset_id: record.dataset_id ?? null,
      kind: record.kind,
      text: record.text,
      read: record.read,
    })
    .select()
    .single()

  if (error) {
    console.warn('Could not insert activity log:', error.message)
    return null
  }
  return data
}

export async function markActivitiesAsRead(userId: string) {
  const client = requireSupabase()
  const { error } = await client
    .from('activity_logs')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) throw error
}

export async function clearActivities(userId: string) {
  const client = requireSupabase()
  const { error } = await client
    .from('activity_logs')
    .delete()
    .eq('user_id', userId)

  if (error) throw error
}

