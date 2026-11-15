import { createClient, type User, type Session } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase configuration. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in .env.local',
  )
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
})

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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || email.split('@')[0],
      },
    },
  })
  if (error) throw error

  // If user is created and session is returned, ensure profile exists
  if (data.user) {
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/#/signin`,
  })
  if (error) throw error
  return data
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ==================== PROFILES ====================

export async function getProfile(userId: string): Promise<ProfileRecord | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn('Could not fetch profile:', error.message)
    return null
  }
  return data
}

export async function upsertProfile(profile: Partial<ProfileRecord> & { id: string }) {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
    .from('datasets')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.warn('Could not fetch datasets:', error.message)
    return []
  }
  return data || []
}

export async function upsertDataset(record: DatasetRecord) {
  const { data, error } = await supabase
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

export async function deleteDataset(id: string) {
  const { error } = await supabase
    .from('datasets')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function renameDataset(id: string, name: string) {
  const { error } = await supabase
    .from('datasets')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// ==================== REPORTS ====================

export async function fetchReports(userId: string): Promise<ReportRecord[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('Could not fetch reports:', error.message)
    return []
  }
  return data || []
}

export async function createReport(record: ReportRecord) {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.warn('Could not fetch activity logs:', error.message)
    return []
  }
  return data || []
}

export async function insertActivity(record: ActivityRecord) {
  const { data, error } = await supabase
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
  const { error } = await supabase
    .from('activity_logs')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    console.warn('Could not mark activities as read:', error.message)
  }
}

export async function clearActivities(userId: string) {
  const { error } = await supabase
    .from('activity_logs')
    .delete()
    .eq('user_id', userId)

  if (error) {
    console.warn('Could not clear activities:', error.message)
  }
}

