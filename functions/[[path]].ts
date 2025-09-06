export async function onRequest(context) {
  const response = await context.next();
  const request = context.request;
  const url = new URL(request.url);
  const accept = request.headers.get('accept') || '';

  const isGetRequest = request.method === 'GET';
  const isHtmlRequest = accept.includes('text/html');
  const isAssetRequest = url.pathname.startsWith('/assets/') ||
                        /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|map)$/.test(url.pathname);

  // HTMLの404は index.html にフォールバック（SPA対応）
  if (response.status === 404 && isGetRequest && isHtmlRequest && !isAssetRequest) {
    return context.env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  }

  return response;
}
