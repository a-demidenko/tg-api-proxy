//NEW
export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'api.telegram.org';
    url.protocol = 'https:';
    url.port = '';

    const headers = new Headers(request.headers);
    headers.delete('host');

    return fetch(url.toString(), {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    });
  }
};