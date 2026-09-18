import { useSyncExternalStore } from 'react'

export type Platform = 'ios' | 'android' | 'other'

const SNOOZE_KEY = 'shift-manager:install:snoozed-until'
const SNOOZE_MS = 7 * 86_400_000

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)
}

export function platform(): Platform {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  // iPadOS 13+ reports as a Mac but has touch.
  if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'other'
}

/**
 * True when the page is inside another app's web view (Gmail, Messenger, Instagram…) or, on iOS,
 * in a third-party browser — none of which can add to the home screen.
 */
export function isWrongBrowser(): boolean {
  const ua = navigator.userAgent
  if (/FBAN|FBAV|Instagram|Line\/|Twitter|Snapchat|GSA\/|; wv\)|WebView/i.test(ua)) return true
  if (platform() === 'ios') {
    // Safari has "Safari/" and no other browser token; in-app web views lack "Safari/" entirely.
    if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua)) return true
    if (!/Safari\//i.test(ua)) return true
  }
  return false
}

export function isSnoozed(): boolean {
  const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0)
  return until > Date.now()
}

export function snooze() {
  localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS))
}

/**
 * Chrome fires `beforeinstallprompt` once per page load, before any component mounts, so we
 * capture it at module level and let components subscribe.
 */
let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
  })
  addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export const getInstallPrompt = () => deferredPrompt

export function subscribeInstallPrompt(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Shows Chrome's native install dialog; resolves true if accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  if (outcome === 'accepted') {
    deferredPrompt = null
    notify()
  }
  return outcome === 'accepted'
}

export const useInstallPrompt = () => useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt)

export const installUrl = () => new URL('/install', window.location.origin).toString()
