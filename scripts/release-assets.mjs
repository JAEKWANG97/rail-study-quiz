// Keep each page's module graph on the same deployment, even with browser/CDN caches.
export function versionAsset(file, bytes, revision) {
  const query = `?v=${encodeURIComponent(revision)}`;
  if (file.endsWith('.html')) {
    return Buffer.from(bytes.toString().replace(/\b(src|href)=(['"])(\.\/[^'"?]+\.(?:js|css))\2/g,
      (_, attribute, quote, url) => `${attribute}=${quote}${url}${query}${quote}`));
  }
  if (file.endsWith('.js')) {
    return Buffer.from(bytes.toString().replace(/\bfrom\s*(['"])(\.\/[^'"?]+\.js)\1/g,
      (_, quote, url) => `from ${quote}${url}${query}${quote}`));
  }
  return bytes;
}
