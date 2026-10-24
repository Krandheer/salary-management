import type { Express } from 'express';
import request from 'supertest';

/** GETs a binary file (such as an .xlsx) and returns the response with `body` as a Buffer. */
export function downloadFile(app: Express, url: string) {
  return request(app)
    .get(url)
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    });
}
