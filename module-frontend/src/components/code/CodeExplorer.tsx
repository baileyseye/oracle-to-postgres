import { useMemo, useState } from 'react';
import { FileCode, Search, X } from 'lucide-react';
import { CODE_MODULES } from '../../data/code-snippets';
import { searchCode, type CodeSearchResult } from '../../lib/code-search';
import { cn } from '../../lib/cn';
import type { CodeFile, CodeModule } from '../../types/code';
import { CodeBlock } from '../ui/CodeBlock';
import { TrafficDots } from '../ui/TrafficDots';

const DEFAULT_MODULE = CODE_MODULES[0];
const DEFAULT_FILE = DEFAULT_MODULE?.files[0];

interface CodeFileRowProps {
  readonly module: CodeModule;
  readonly file: CodeFile;
  readonly active: boolean;
  readonly showModule: boolean;
  readonly onSelect: () => void;
}

function CodeFileRow({
  module,
  file,
  active,
  showModule,
  onSelect,
}: CodeFileRowProps) {
  const snippet = file.snippets[0];

  return (
    <button
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
        active
          ? 'bg-surface-2 text-text'
          : 'text-muted hover:bg-surface/60 hover:text-text',
      )}
      onClick={onSelect}
      type="button"
    >
      <FileCode
        aria-hidden="true"
        className={cn(
          'mt-0.5 h-3.5 w-3.5 shrink-0',
          active ? 'text-electric' : 'text-muted/70',
        )}
      />
      <span className="min-w-0">
        <span className="block truncate font-mono text-caption">
          {file.name}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-micro text-muted/70">
          {showModule ? <span>{module.label}</span> : null}
          {snippet ? (
            <span>
              {snippet.startLine}–{snippet.endLine}
            </span>
          ) : null}
        </span>
        <span className="mt-1 block line-clamp-2 text-caption leading-relaxed text-muted/80">
          {file.summary}
        </span>
      </span>
    </button>
  );
}

export function CodeExplorer() {
  const [moduleId, setModuleId] = useState<CodeModule['id']>(
    DEFAULT_MODULE?.id ?? 'migration',
  );
  const [fileId, setFileId] = useState(
    DEFAULT_FILE?.id ?? '',
  );
  const [query, setQuery] = useState('');

  const activeModule =
    CODE_MODULES.find((module) => module.id === moduleId) ??
    DEFAULT_MODULE;
  const activeFile =
    activeModule?.files.find((file) => file.id === fileId) ??
    activeModule?.files[0];
  const results = useMemo(
    () => searchCode(CODE_MODULES, query),
    [query],
  );
  const searchActive = query.trim().length > 0;
  const searchSelection = searchActive
    ? (results.find(
        (result) =>
          result.module.id === moduleId && result.file.id === fileId,
      ) ??
      results[0] ??
      null)
    : null;

  const displayModule = searchActive
    ? (searchSelection?.module ?? null)
    : (activeModule ?? null);
  const displayFile = searchActive
    ? (searchSelection?.file ?? null)
    : (activeFile ?? null);
  const displaySnippet = displayFile?.snippets[0] ?? null;

  const handleModuleChange = (nextModule: CodeModule) => {
    setQuery('');
    setModuleId(nextModule.id);
    setFileId(nextModule.files[0]?.id ?? '');
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);

    if (value.trim()) {
      const first = searchCode(CODE_MODULES, value)[0];

      if (first) {
        setModuleId(first.module.id);
        setFileId(first.file.id);
      }
    }
  };

  const handleSelectResult = (result: CodeSearchResult) => {
    setModuleId(result.module.id);
    setFileId(result.file.id);
  };

  return (
    <div className="panel min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <TrafficDots />
          <span className="truncate font-mono text-caption text-muted">
            обозреватель кода
          </span>
        </div>
        <span className="font-mono text-micro text-muted/80">
          {CODE_MODULES.reduce((total, module) => total + module.files.length, 0)}{' '}
          файлов
        </span>
      </div>

      <div className="border-b border-line p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div
            aria-label="Модули кода"
            className="flex shrink-0 flex-wrap gap-1"
            role="group"
          >
            {CODE_MODULES.map((module) => {
              const active = module.id === moduleId;

              return (
                <button
                  aria-pressed={active}
                  className={cn(
                    'relative shrink-0 rounded-md px-3 py-2 text-left transition-colors',
                    active
                      ? 'bg-surface-2 text-text'
                      : 'text-muted hover:bg-surface/60 hover:text-text',
                  )}
                  key={module.id}
                  onClick={() => handleModuleChange(module)}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'status-led',
                        active ? 'text-electric' : 'text-muted/70',
                      )}
                    />
                    <span className="font-mono text-caption">
                      {module.label}
                    </span>
                    <span className="font-mono text-micro text-muted/70">
                      :{module.port}
                    </span>
                  </span>
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="migration-line absolute inset-x-2.5 bottom-0"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/70"
            />
            <input
              aria-label="Поиск по коду"
              className="h-9 w-full rounded-md border border-line bg-bg/45 pl-8 pr-16 font-mono text-caption text-text placeholder:text-muted/70 focus:border-electric/40 focus:ring-1 focus:ring-electric/30"
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setQuery('');
                }
              }}
              placeholder="Поиск: класс, метод, SQL…"
              type="text"
              value={query}
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searchActive ? (
                <span
                  aria-live="polite"
                  className="font-mono text-micro text-muted/70"
                >
                  {results.length}
                </span>
              ) : null}
              {query ? (
                <button
                  aria-label="Очистить поиск"
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-surface/70 hover:text-text"
                  onClick={() => setQuery('')}
                  type="button"
                >
                  <X aria-hidden="true" className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-line lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-line/60 px-3 py-2 font-mono text-micro text-muted/80">
            <span>{searchActive ? 'результаты поиска' : 'файлы'}</span>
            <span className="text-muted/70">
              {searchActive ? results.length : activeModule?.files.length}
            </span>
          </div>
          <div className="scroll-area max-h-[300px] overflow-y-auto p-2 lg:max-h-[620px]">
            {searchActive ? (
              results.length > 0 ? (
                <div className="space-y-0.5">
                  {results.map((result) => (
                    <CodeFileRow
                      active={
                        displayModule?.id === result.module.id &&
                        displayFile?.id === result.file.id
                      }
                      file={result.file}
                      key={`${result.module.id}-${result.file.id}`}
                      module={result.module}
                      onSelect={() => handleSelectResult(result)}
                      showModule
                    />
                  ))}
                </div>
              ) : (
                <div className="px-2 py-6 text-center">
                  <p className="font-mono text-caption text-muted/80">
                    ничего не найдено
                  </p>
                  <p className="mt-1 text-caption leading-relaxed text-muted/70">
                    Попробуйте имя класса, метода или SQL-фрагмент.
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-0.5">
                {activeModule?.files.map((file) => (
                  <CodeFileRow
                    active={file.id === activeFile?.id}
                    file={file}
                    key={file.id}
                    module={activeModule}
                    onSelect={() => setFileId(file.id)}
                    showModule={false}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0 p-4">
          {displayModule && displayFile && displaySnippet ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-micro text-muted/80">
                    <span>{displayModule.label}</span>
                    <span className="text-muted/70">/</span>
                    <span>{displaySnippet.title}</span>
                  </div>
                  <h3 className="mt-1 break-words font-mono text-[15px] text-text">
                    {displayFile.name}
                  </h3>
                  <p className="mt-1 text-caption leading-relaxed text-muted/75">
                    {displayFile.summary}
                  </p>
                </div>
                <span className="shrink-0 rounded border border-line bg-bg/35 px-1.5 py-0.5 font-mono text-micro text-muted/80">
                  {displaySnippet.startLine}–{displaySnippet.endLine}
                </span>
              </div>

              <div className="rounded-md border border-electric/20 bg-electric/5 px-3 py-2.5">
                <p className="font-mono text-micro text-electric/80">
                  что здесь важно
                </p>
                <p className="mt-1 text-caption leading-relaxed text-text/80">
                  {displaySnippet.note}
                </p>
              </div>

              <CodeBlock
                code={displaySnippet.code}
                endLine={displaySnippet.endLine}
                fileName={displayFile.name}
                filePath={displayFile.path}
                githubUrl={displayFile.githubUrl}
                language={displayFile.language}
                maxHeightClass="max-h-[520px]"
                startLine={displaySnippet.startLine}
              />
            </div>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-4 text-center">
              <Search
                aria-hidden="true"
                className="h-6 w-6 text-muted/70"
              />
              <p className="mt-3 font-mono text-micro text-muted/80">
                {searchActive ? 'Поиск не дал файлов' : 'Выберите файл'}
              </p>
              <p className="mt-1 max-w-xs text-caption leading-relaxed text-muted/70">
                {searchActive
                  ? 'Измените запрос или очистите поиск, чтобы вернуться к списку файлов.'
                  : 'Слева — файлы выбранного модуля; справа появится сниппет.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line px-4 py-2 font-mono text-micro text-muted/70">
        сниппеты — методы целиком · полный файл доступен по ссылке GitHub
      </div>
    </div>
  );
}
