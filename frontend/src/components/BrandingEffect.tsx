import { useEffect } from 'react'
import { faviconUrl, useBranding } from '../hooks/useBranding'

export default function BrandingEffect() {
  const { data } = useBranding()
  useEffect(() => {
    if (!data) return
    document.title = data.appName
    try { localStorage.setItem('spares_branding', JSON.stringify({ appName: data.appName })) } catch { /* ignore */ }
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.removeAttribute('type')
    link.href = data.hasFavicon ? faviconUrl(data) : 'data:,'
  }, [data])
  return null
}