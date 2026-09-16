// Database webhook target: turns shift/offer changes into Web Push notifications.
// Called by the notify_webhook() trigger (migration 0004) with a Supabase-style
// payload { type, table, record, old_record }. Auth is a shared secret header.
//
// Secrets (supabase secrets set): NOTIFY_WEBHOOK_SECRET, VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Op = 'INSERT' | 'UPDATE' | 'DELETE'

interface ShiftRow {
  id: string
  employee_id: string | null
  position: string
  shift_date: string
  start_min: number
  end_min: number
}

interface OfferRow {
  id: string
  shift_id: string
  offered_by: string
  target_employee_id: string | null
  claimed_by: string | null
  status: 'open' | 'claimed' | 'cancelled'
}

interface Payload {
  type: Op
  table: 'shifts' | 'shift_offers'
  record: ShiftRow | OfferRow | null
  old_record: ShiftRow | OfferRow | null
}

interface Employee {
  id: string
  name: string
  positions: string[]
  user_id: string | null
  active: boolean
}

interface Note {
  title: string
  body: string
  url: string
  tag: string
}

const CLOSE_MIN = 23 * 60

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:shifts@send.presscaddie.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

function fmtTime(min: number): string {
  const h24 = Math.floor(min / 60)
  const m = min % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h24 >= 12 ? 'PM' : 'AM'}`
}

function fmtRange(s: ShiftRow): string {
  return `${fmtTime(s.start_min)}–${s.end_min >= CLOSE_MIN ? 'Close' : fmtTime(s.end_min)}`
}

function fmtDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function when(s: ShiftRow): string {
  return `${fmtDate(s.shift_date)} · ${fmtRange(s)}`
}

async function loadEmployees(): Promise<Map<string, Employee>> {
  const { data, error } = await admin.from('employees').select('id,name,positions,user_id,active')
  if (error) throw error
  return new Map((data as Employee[]).map((e) => [e.id, e]))
}

async function adminUserIds(): Promise<string[]> {
  const { data, error } = await admin.from('profiles').select('id').eq('role', 'admin')
  if (error) throw error
  return (data as { id: string }[]).map((p) => p.id)
}

async function loadShift(id: string): Promise<ShiftRow | null> {
  const { data } = await admin.from('shifts').select('id,employee_id,position,shift_date,start_min,end_min').eq('id', id).maybeSingle()
  return data as ShiftRow | null
}

/** Build the list of (user_id → note) for this event. */
async function plan(p: Payload): Promise<Map<string, Note>> {
  const out = new Map<string, Note>()
  const emps = await loadEmployees()
  const userOf = (empId: string | null | undefined) => (empId ? emps.get(empId)?.user_id ?? null : null)
  const nameOf = (empId: string | null | undefined) => (empId ? emps.get(empId)?.name ?? 'Someone' : 'Someone')
  const add = (userId: string | null, note: Note) => {
    if (userId && !out.has(userId)) out.set(userId, note)
  }

  if (p.table === 'shift_offers' && p.record) {
    const o = p.record as OfferRow
    const old = p.old_record as OfferRow | null
    const shift = await loadShift(o.shift_id)
    if (!shift) return out
    const admins = await adminUserIds()
    const offerer = nameOf(o.offered_by)

    if (p.type === 'INSERT' && o.status === 'open') {
      const note: Note = {
        title: 'Shift available',
        body: `${when(shift)} ${shift.position} — from ${offerer}. Tap to claim.`,
        url: '/offers',
        tag: `offer-${o.id}`,
      }
      if (o.target_employee_id) {
        add(userOf(o.target_employee_id), { ...note, body: `${offerer} offered you ${when(shift)} ${shift.position}.` })
      } else {
        for (const e of emps.values()) {
          if (e.active && e.id !== o.offered_by && e.positions.includes(shift.position)) add(e.user_id, note)
        }
      }
      const offererUser = userOf(o.offered_by)
      for (const a of admins) {
        if (a !== offererUser) add(a, { ...note, title: 'New shift offer', body: `${offerer} is offering ${when(shift)} ${shift.position}.` })
      }
    }

    if (p.type === 'UPDATE' && o.status === 'claimed' && old?.status !== 'claimed') {
      const claimer = nameOf(o.claimed_by)
      const tag = `offer-${o.id}`
      add(userOf(o.offered_by), {
        title: 'Your shift was picked up',
        body: `${claimer} took your ${when(shift)} ${shift.position}.`,
        url: '/offers',
        tag,
      })
      const claimerUser = userOf(o.claimed_by)
      for (const a of admins) {
        if (a !== claimerUser) add(a, { title: 'Offer claimed', body: `${claimer} took ${offerer}'s ${when(shift)} ${shift.position}.`, url: '/offers', tag })
      }
    }

    if (p.type === 'UPDATE' && o.status === 'cancelled' && old?.status === 'open') {
      add(userOf(o.offered_by), {
        title: 'Offer cancelled',
        body: `Your offer for ${when(shift)} ${shift.position} was cancelled — you're still on it.`,
        url: '/schedule',
        tag: `offer-${o.id}`,
      })
    }
  }

  if (p.table === 'shifts' && p.type === 'UPDATE' && p.record && p.old_record) {
    const s = p.record as ShiftRow
    const old = p.old_record as ShiftRow
    const tag = `shift-${s.id}`

    if (s.employee_id !== old.employee_id) {
      // A claim reassigns the shift too; the offer notifications already cover it.
      const { data: claimed } = await admin
        .from('shift_offers')
        .select('id')
        .eq('shift_id', s.id)
        .eq('status', 'claimed')
        .eq('claimed_by', s.employee_id ?? '00000000-0000-0000-0000-000000000000')
        .gte('resolved_at', new Date(Date.now() - 15_000).toISOString())
        .limit(1)
      if (claimed && claimed.length > 0) return out

      add(userOf(s.employee_id), { title: 'New shift', body: `You're on ${when(s)} ${s.position}.`, url: '/schedule', tag })
      add(userOf(old.employee_id), { title: 'Shift removed', body: `You're no longer on ${when(old)} ${old.position}.`, url: '/schedule', tag })
    } else {
      add(userOf(s.employee_id), {
        title: 'Shift changed',
        body: `${fmtDate(old.shift_date)} ${fmtRange(old)} → ${when(s)}.`,
        url: '/schedule',
        tag,
      })
    }
  }

  return out
}

interface Sub {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

async function send(notes: Map<string, Note>): Promise<{ sent: number; dropped: number }> {
  if (notes.size === 0) return { sent: 0, dropped: 0 }
  const { data, error } = await admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth').in('user_id', [...notes.keys()])
  if (error) throw error
  let sent = 0
  const dead: string[] = []
  await Promise.all(
    (data as Sub[]).map(async (sub) => {
      const note = notes.get(sub.user_id)!
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(note),
          { TTL: 60 * 60 * 12 },
        )
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) dead.push(sub.id)
        else console.error('push failed', status, (e as Error).message)
      }
    }),
  )
  if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead)
  return { sent, dropped: dead.length }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('NOTIFY_WEBHOOK_SECRET')) {
    return new Response('unauthorized', { status: 401 })
  }
  try {
    const payload = (await req.json()) as Payload
    const result = await send(await plan(payload))
    return Response.json(result)
  } catch (e) {
    console.error(e)
    return new Response(String((e as Error).message ?? e), { status: 500 })
  }
})
