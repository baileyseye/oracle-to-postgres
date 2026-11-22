import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin, ProxyOptions } from 'vite';

function createBackendProxy(
  alias: string,
  target: string,
  apiPrefix: string,
): ProxyOptions {
  const aliasPattern = new RegExp(`^${alias}`);

  return {
    target,
    changeOrigin: true,
    rewrite: (path) =>
      path
        .replace(new RegExp(`^${alias}/actuator`), '/actuator')
        .replace(aliasPattern, apiPrefix),
    configure: (proxy) => {
      proxy.on('error', (_error, _request, response) => {
        if (!response.headersSent) {
          response.writeHead(503, {
            'Content-Type': 'application/json',
          });
          response.end(
            JSON.stringify({
              status: 503,
              error: 'Service Unavailable',
              message: 'Backend недоступен через Vite proxy',
            }),
          );
        }
      });
    },
  };
}

const DEV_SEED_ENDPOINT = '/__dev/seed-large-oracle';
const DEV_SEED_SCRIPT = fileURLToPath(
  new URL('../scripts/seed-large-oracle.ps1', import.meta.url),
);
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEV_SEED_TIMEOUT_MS = 15 * 60 * 1000;

function createDevSeedPlugin(): Plugin {
  let running = false;

  return {
    name: 'oracle-to-postgres-dev-seed',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(DEV_SEED_ENDPOINT, (request, response) => {
        const sendJson = (statusCode: number, body: unknown) => {
          response.statusCode = statusCode;
          response.setHeader(
            'Content-Type',
            'application/json; charset=utf-8',
          );
          response.end(JSON.stringify(body));
        };

        if (request.method !== 'POST') {
          sendJson(405, { ok: false, message: 'Используйте POST' });
          return;
        }

        const remoteAddress = request.socket.remoteAddress ?? '';
        const localAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

        if (!localAddresses.includes(remoteAddress)) {
          sendJson(403, {
            ok: false,
            message: 'Dev seed доступен только с localhost',
          });
          return;
        }

        if (request.headers['x-demo-seed'] !== 'SEED') {
          sendJson(403, {
            ok: false,
            message: 'Неверный заголовок подтверждения',
          });
          return;
        }

        if (running) {
          sendJson(409, {
            ok: false,
            message: 'Загрузка большого датасета уже выполняется',
          });
          return;
        }

        if (process.platform !== 'win32') {
          sendJson(501, {
            ok: false,
            message: 'Dev seed реализован для Windows и PowerShell',
          });
          return;
        }

        if (!existsSync(DEV_SEED_SCRIPT)) {
          sendJson(500, {
            ok: false,
            message: 'Не найден scripts/seed-large-oracle.ps1',
          });
          return;
        }

        running = true;
        const startedAt = Date.now();
        let output = '';
        let finished = false;
        let timeout: NodeJS.Timeout | null = null;

        const finish = (
          statusCode: number,
          body: Record<string, unknown>,
        ) => {
          if (finished) {
            return;
          }

          finished = true;
          running = false;

          if (timeout) {
            clearTimeout(timeout);
          }

          if (!response.writableEnded && !response.destroyed) {
            sendJson(statusCode, body);
          }
        };

        const child = spawn(
          'powershell.exe',
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            DEV_SEED_SCRIPT,
          ],
          { cwd: REPO_ROOT, windowsHide: true },
        );

        const append = (chunk: Buffer) => {
          output = `${output}${chunk.toString()}`.slice(-30000);
        };

        child.stdout?.on('data', append);
        child.stderr?.on('data', append);

        timeout = setTimeout(() => {
          child.kill();
          finish(504, {
            ok: false,
            message: 'Загрузка не завершилась за 15 минут',
            output,
          });
        }, DEV_SEED_TIMEOUT_MS);

        child.on('error', (error) => {
          finish(500, {
            ok: false,
            message: `Не удалось запустить PowerShell: ${error.message}`,
            output,
          });
        });

        child.on('close', (code) => {
          finish(code === 0 ? 200 : 500, {
            ok: code === 0,
            exitCode: code,
            durationMs: Date.now() - startedAt,
            output,
            message:
              code === 0
                ? 'Large Oracle dataset is ready'
                : 'Скрипт seed завершился с ошибкой',
          });
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), createDevSeedPlugin()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/oracle': createBackendProxy(
        '/api/oracle',
        'http://localhost:8081',
        '/api/v1/oracle',
      ),
      '/api/postgres': createBackendProxy(
        '/api/postgres',
        'http://localhost:8082',
        '/api/v1/postgres',
      ),
      '/api/migration': createBackendProxy(
        '/api/migration',
        'http://localhost:8083',
        '/api/v1/migration',
      ),
      '/api/schema': createBackendProxy(
        '/api/schema',
        'http://localhost:8084',
        '/api/v1/schema-migration',
      ),
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'motion-vendor': ['framer-motion'],
          'prism-vendor': ['prismjs', 'prism-react-renderer'],
          'icons-vendor': ['lucide-react'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
