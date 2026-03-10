import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const host = '127.0.0.1';
const requestedPort = Number(process.env.CTI_SMOKE_WEBHOOK_PORT || '0');
const captureFile =
  process.env.CTI_SMOKE_CAPTURE_FILE ||
  path.join(os.tmpdir(), `cti-smoke-capture-${process.pid}.json`);

const requests = [];

const server = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString('utf8');
  requests.push({
    body,
    headers: request.headers,
    method: request.method ?? 'GET',
    url: request.url ?? '/',
  });

  fs.writeFileSync(captureFile, JSON.stringify({ requests }, null, 2), 'utf8');

  response.writeHead(202, { 'content-type': 'application/json' });
  response.end(
    JSON.stringify({
      ok: true,
      requestCount: requests.length,
    }),
  );
});

server.listen(requestedPort, host, () => {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine fake webhook server address');
  }

  process.stdout.write(
    JSON.stringify({
      captureFile,
      host,
      port: address.port,
    }) + '\n',
  );
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
