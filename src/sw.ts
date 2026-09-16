/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// App shell only; data always comes from Supabase/localStorage, never the SW cache.
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/\.netlify\//] }))

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

interface PushNote {
  title: string
  body: string
  url?: string
  tag?: string
}

self.addEventListener('push', (e) => {
  let note: PushNote = { title: 'Shift Manager', body: e.data?.text() ?? '' }
  try {
    if (e.data) note = { ...note, ...(e.data.json() as PushNote) }
  } catch {
    /* plain-text payload */
  }
  e.waitUntil(
    self.registration.showNotification(note.title, {
      body: note.body,
      tag: note.tag,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: note.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL((e.notification.data as { url?: string })?.url ?? '/', self.location.origin).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((c) => c.url.startsWith(self.location.origin))
      if (existing) {
        await existing.focus()
        if ('navigate' in existing) await existing.navigate(url)
        return
      }
      await self.clients.openWindow(url)
    }),
  )
})
