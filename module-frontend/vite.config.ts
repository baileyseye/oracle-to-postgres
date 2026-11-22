import { spawn, type ChildProcess } from 'node:child_process';
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
const DEV_SEED_CONTAINER = 'oracle-to-postgres-oracle';
const DEV_SEED_TIMEOUT_MS = 15 * 60 * 1000;
const PROCESS_TREE_KILL_TIMEOUT_MS = 5_000;

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

/**
 * `child.kill()` on Windows terminates only powershell.exe, while the real
 * work happens in its descendants (docker.exe → sqlplus). `taskkill /T`
 * walks the whole process tree, so a timed-out seed cannot keep writing to
 * Oracle. On POSIX the child is a process-group leader (see `detached`
 * below), so the entire group is killed instead.
 */
function killProcessTree(child: ChildProcess): Promise<void> {
  const pid = child.pid;

  if (!pid || hasExited(child)) {
    return Promise.resolve();
  }

  if (process.platform !== 'win32') {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    let guard: NodeJS.Timeout | null = null;

    const settle = () => {
      if (settled) {
        return;
      }

      settled = true;

      if (guard) {
        clearTimeout(guard);
      }

      resolve();
    };

    const killer = spawn(
      'taskkill',
      ['/pid', String(pid), '/T', '/F'],
      { stdio: 'ignore', windowsHide: true },
    );

    guard = setTimeout(() => {
      child.kill();
      settle();
    }, PROCESS_TREE_KILL_TIMEOUT_MS);
    guard.unref();

    killer.once('close', settle);
    killer.once('error', () => {
      child.kill();
      settle();
    });
  });
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (hasExited(child)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let timer: NodeJS.Timeout | null = null;

    const done = () => {
      if (timer) {
        clearTimeout(timer);
      }

      child.removeListener('close', done);
      child.removeListener('exit', done);
      resolve();
    };

    timer = setTimeout(done, timeoutMs);
    timer.unref();

    child.once('close', done);
    child.once('exit', done);
  });
}

/**
 * Killing docker.exe only closes the client connection; the exec process
 * started inside the container (sqlplus) keeps running (moby/moby#9098).
 * Ask the container itself to stop the seed session. The Oracle image has no
 * pkill/pgrep/ps, so walk /proc and kill every process whose cmdline mentions
 * the seed SQL file. The `[s]` regex keeps the cleanup shell from matching
 * its own command line.
 */
function stopInContainerSeed(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let guard: NodeJS.Timeout | null = null;

    const settle = () => {
      if (settled) {
        return;
      }

      settled = true;

      if (guard) {
        clearTimeout(guard);
      }

      resolve();
    };

    const script = [
      'for f in /proc/[0-9]*/cmdline; do',
      'pid=${f#/proc/};',
      'pid=${pid%/cmdline};',
      '[ "$pid" = "$$" ] && continue;',
      'if grep -aq -- \'[s]eed-large-oracle.sql\' "$f" 2>/dev/null; then',
      'kill -9 "$pid" 2>/dev/null || true;',
      'fi;',
      'done',
    ].join(' ');

    const cleaner = spawn(
      'docker',
      ['exec', DEV_SEED_CONTAINER, 'bash', '-lc', script],
      { stdio: 'ignore', windowsHide: true },
    );

    guard = setTimeout(settle, PROCESS_TREE_KILL_TIMEOUT_MS);
    guard.unref();

    cleaner.once('close', settle);
    cleaner.once('error', settle);
  });
}

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
            message:
              'Загрузка большого датасета уже выполняется на dev-сервере. ' +
              'Дождитесь её завершения (до 15 минут). Перезагрузка или ' +
              'закрытие вкладки останавливает seed.',
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
          {
            cwd: REPO_ROOT,
            windowsHide: true,
            detached: process.platform !== 'win32',
          },
        );

        const append = (chunk: Buffer) => {
          output = `${output}${chunk.toString()}`.slice(-30000);
        };

        child.stdout?.on('data', append);
        child.stderr?.on('data', append);

        /**
         * Force-stops the seed and releases the `running` lock only after the
         * process tree is gone. Releasing it earlier would let a retry start a
         * second writer next to a still-dying one.
         */
        const stop = async (
          statusCode: number,
          body: Record<string, unknown>,
        ) => {
          if (finished) {
            return;
          }

          finished = true;

          if (timeout) {
            clearTimeout(timeout);
          }

          server.config.logger.warn(
            `[dev-seed] остановка: ${String(body.message ?? 'причина неизвестна')}`,
          );

          try {
            await killProcessTree(child);
            await waitForExit(child, PROCESS_TREE_KILL_TIMEOUT_MS);
            await stopInContainerSeed();
          } finally {
            running = false;

            if (!response.writableEnded && !response.destroyed) {
              sendJson(statusCode, body);
            }
          }
        };

        const stopSeed = (statusCode: number, body: Record<string, unknown>) => {
          stop(statusCode, body).catch((error: unknown) => {
            server.config.logger.error(
              `[dev-seed] не удалось остановить процесс: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          });
        };

        timeout = setTimeout(() => {
          stopSeed(504, {
            ok: false,
            message:
              'Загрузка не завершилась за 15 минут, процесс seed остановлен',
            output,
          });
        }, DEV_SEED_TIMEOUT_MS);

        // The browser reloaded the tab, navigated away or aborted the fetch.
        // Without this listener the script tree would outlive the request for
        // up to 15 minutes, keep writing to Oracle and leave `running` set,
        // so the next attempt would get an unexplained 409.
        response.on('close', () => {
          if (finished || response.writableEnded) {
            return;
          }

          stopSeed(499, {
            ok: false,
            message:
              'Клиент закрыл соединение — процесс seed остановлен',
            output,
          });
        });

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
