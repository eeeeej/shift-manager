import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// Phones report well under 768px in landscape (esp. with Android display scaling), so treat any wide-enough landscape viewport as desktop too.
export const useIsDesktop = () =>
  useMediaQuery('(min-width: 768px), (orientation: landscape) and (min-width: 600px)')
