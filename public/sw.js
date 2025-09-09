// 서비스 워커 - 오프라인 캐싱 및 성능 최적화
const CACHE_NAME = 'money-dashboard-v1';
const API_CACHE_NAME = 'money-api-v1';

// 캐시할 리소스 목록
const STATIC_CACHE_URLS = [
  '/',
  '/customers',
  '/transactions',
  '/statement',
  '/login',
  '/manifest.json'
];

// API 캐시 설정
const API_CACHE_PATTERNS = [
  '/api/dashboard',
  '/api/customers',
  '/api/transactions'
];

// 서비스 워커 설치
self.addEventListener('install', (event) => {
  console.log('🚀 서비스 워커 설치 중...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 정적 리소스 캐싱 중...');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('✅ 서비스 워커 설치 완료');
        return self.skipWaiting();
      })
  );
});

// 서비스 워커 활성화
self.addEventListener('activate', (event) => {
  console.log('🔄 서비스 워커 활성화 중...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('🗑️ 오래된 캐시 삭제:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ 서비스 워커 활성화 완료');
        return self.clients.claim();
      })
  );
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // API 요청 처리
  if (API_CACHE_PATTERNS.some(pattern => url.pathname.includes(pattern))) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // 정적 리소스 처리
  if (request.method === 'GET') {
    event.respondWith(handleStaticRequest(request));
  }
});

// API 요청 처리 (캐시 우선, 네트워크 폴백)
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // 캐시된 응답이 있고 5분 이내라면 캐시 사용
  if (cachedResponse) {
    const cacheTime = cachedResponse.headers.get('sw-cache-time');
    if (cacheTime && Date.now() - parseInt(cacheTime) < 5 * 60 * 1000) {
      console.log('📦 API 캐시 사용:', request.url);
      return cachedResponse;
    }
  }
  
  try {
    // 네트워크에서 최신 데이터 가져오기
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // 응답을 복사하고 캐시 시간 추가
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      // 캐시에 저장
      cache.put(request, modifiedResponse);
      console.log('💾 API 응답 캐시 저장:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('❌ 네트워크 오류, 캐시 사용:', request.url);
    
    // 네트워크 오류 시 캐시된 응답 반환
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 캐시도 없으면 오프라인 페이지 반환
    return new Response(
      JSON.stringify({ 
        error: '오프라인 상태입니다. 네트워크 연결을 확인해주세요.',
        offline: true 
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// 정적 리소스 처리 (캐시 우선, 네트워크 폴백)
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    console.log('📦 정적 리소스 캐시 사용:', request.url);
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      console.log('💾 정적 리소스 캐시 저장:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('❌ 정적 리소스 로드 실패:', request.url);
    
    // HTML 페이지 요청이면 오프라인 페이지 반환
    if (request.headers.get('accept')?.includes('text/html')) {
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>오프라인 - 돈 관리 시스템</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: #f3f4f6;
              }
              .offline-container {
                text-align: center;
                padding: 2rem;
                background: white;
                border-radius: 0.5rem;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              }
              .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
              .offline-title { font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; color: #374151; }
              .offline-message { color: #6b7280; margin-bottom: 1rem; }
              .retry-button {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 0.375rem;
                cursor: pointer;
                font-size: 1rem;
              }
              .retry-button:hover { background: #2563eb; }
            </style>
          </head>
          <body>
            <div class="offline-container">
              <div class="offline-icon">📡</div>
              <div class="offline-title">오프라인 상태</div>
              <div class="offline-message">네트워크 연결을 확인하고 다시 시도해주세요.</div>
              <button class="retry-button" onclick="window.location.reload()">다시 시도</button>
            </div>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    throw error;
  }
}

// 백그라운드 동기화 (선택적)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('🔄 백그라운드 동기화 실행');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // 오프라인 중에 저장된 데이터가 있다면 동기화
  console.log('📤 오프라인 데이터 동기화 중...');
  // 실제 동기화 로직 구현
}
