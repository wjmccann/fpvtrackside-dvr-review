const VIDEO_CACHE = 'video-cache-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/api/video/')) return;

  event.respondWith(handleVideoRequest(event.request, url));
});

async function handleVideoRequest(request, url) {
  const cache = await caches.open(VIDEO_CACHE);
  // Match using a URL without range headers — strip to just origin+pathname
  const cacheUrl = url.origin + url.pathname;
  const cached = await cache.match(cacheUrl);

  if (!cached) return fetch(request);

  const rangeHeader = request.headers.get('Range');
  if (!rangeHeader) return cached.clone();

  return createRangeResponse(cached, rangeHeader);
}

async function createRangeResponse(fullResponse, rangeHeader) {
  const blob = await fullResponse.blob();
  const totalSize = blob.size;
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) return new Response(blob, { status: 200 });

  const start = parseInt(match[1]);
  const end = match[2] ? parseInt(match[2]) : totalSize - 1;
  const slice = blob.slice(start, end + 1);

  return new Response(slice, {
    status: 206,
    headers: {
      'Content-Type': fullResponse.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
