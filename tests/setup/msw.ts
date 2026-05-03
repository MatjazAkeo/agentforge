import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://openrouter.ai/api/v1/models', () =>
    HttpResponse.json({ data: [] }),
  ),
];

export const server = setupServer(...handlers);
