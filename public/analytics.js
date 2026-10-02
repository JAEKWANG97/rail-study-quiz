// siteId is the public Web Analytics beacon identifier, never an API credential.
export function shouldTrack({hostname, pathname}, navigator, siteId) {
  return /^[a-f0-9]{32}$/.test(siteId || '')
    && hostname === 'jaekwang97.github.io'
    && (pathname === '/rail-study-quiz' || pathname.startsWith('/rail-study-quiz/'))
    && navigator.doNotTrack !== '1' && !navigator.webdriver;
}

export function beacon(document, siteId) {
  const script = document.createElement('script');
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.type = 'module';
  script.defer = true;
  script.setAttribute('data-cf-beacon', JSON.stringify({token:siteId}));
  return script;
}

export async function startAnalytics() {
  try {
    const response = await fetch('./analytics-config.json');
    if (!response.ok) return;
    const config = await response.json();
    if (config.provider !== 'cloudflare' || !/^[a-f0-9]{32}$/.test(config.siteId || '')) return;
    const notice = document.getElementById('analytics-notice');
    if (notice) notice.hidden = false;
    if (!shouldTrack(location, navigator, config.siteId)) return;
    document.head.append(beacon(document, config.siteId));
  } catch {
    // Analytics being blocked or unavailable must never interrupt study.
  }
}
if (typeof window !== 'undefined') void startAnalytics();
