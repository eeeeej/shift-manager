import { useCallback, useEffect, useState } from 'react'
import { isDemoMode, supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState =
  | 'unsupported' // browser can't do push (or iPhone not installed to home screen)
  | 'unavailable' // no VAPID key configured (demo)
  | 'denied' // user blocked notifications in the browser
  | 'off'
  | 'on'
  | 'busy'

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  if (!supabase) return
  const json = sub.toJSON()
  const { error } = await supabase.rpc('bind_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent.slice(0, 200),
  })
  if (error) throw error
}

/**
 * Web Push opt-in for the signed-in user; one subscription per device.
 * The device subscription follows whoever is logged in: on load it is re-saved
 * under the current user so a shared/switched phone notifies the right person.
 */
export function usePush(userId: string | undefined) {
  const [state, setState] = useState<PushState>('busy')

  const refresh = useCallback(async () => {
    if (!supported()) return setState('unsupported')
    if (isDemoMode || !VAPID_PUBLIC_KEY || !supabase) return setState('unavailable')
    if (Notification.permission === 'denied') return setState('denied')
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub && userId) {
      try {
        await saveSubscription(sub)
      } catch (e) {
        console.error('push rebind failed', e)
      }
    }
    setState(sub ? 'on' : 'off')
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const enable = useCallback(async () => {
    if (!supabase || !VAPID_PUBLIC_KEY || !userId) return
    setState('busy')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return setState(permission === 'denied' ? 'denied' : 'off')
      const reg = await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }))
      await saveSubscription(sub)
      setState('on')
    } catch (e) {
      console.error('push enable failed', e)
      setState('off')
    }
  }, [userId])

  const disable = useCallback(async () => {
    if (!supabase) return
    setState('busy')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await supabase.rpc('unbind_push_subscription', { p_endpoint: sub.endpoint })
        await sub.unsubscribe()
      }
    } finally {
      setState('off')
    }
  }, [])

  return { state, enable, disable }
}
