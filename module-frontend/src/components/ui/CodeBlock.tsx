import { ArrowUpRight, Check, Copy } from 'lucide-react';
import { Highlight } from 'prism-react-renderer';
import { CODE_THEME } from '../../lib/code-theme';
import { cn } from '../../lib/cn';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { Prism } from '../../lib/prism';
import type { CodeLanguage } from '../../types/code';

interface CodeBlockProps {
  readonly code: string;
  readonly language: CodeLanguage;
  readonly fileName: string;
  readonly filePath: string;
  readonly githubUrl: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly maxHeightClass?: string;
}

export function CodeBlock({
  code,
  language,
  fileName,
  filePath,
  githubUrl,
  startLine,
  endLine,
  maxHeightClass = 'max-h-[340px]',
}: CodeBlockProps) {
  const { copied, copy } = useCopyFeedback();

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-bg/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/55 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-caption text-text/85">
            {fileName}
          </div>
          <div className="mt-0.5 truncate font-mono text-micro text-muted/70">
            строки {startLine}–{endLine}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            aria-label={copied ? 'Код скопирован' : 'Скопировать код'}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface/70 px-2 font-mono text-micro text-muted transition-colors hover:border-electric/40 hover:text-text"
            onClick={() => {
              void copy(code);
            }}
            title={copied ? 'Скопировано' : 'Скопировать код'}
            type="button"
          >
            {copied ? (
              <Check aria-hidden="true" className="h-3 w-3 text-ok" />
            ) : (
              <Copy aria-hidden="true" className="h-3 w-3" />
            )}
            <span aria-live="polite">
              {copied ? 'Скопировано ✓' : 'Копировать'}
            </span>
          </button>
          <a
            aria-label={`Открыть ${fileName} на GitHub`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface/70 text-muted transition-colors hover:border-electric/40 hover:text-text"
            href={githubUrl}
            rel="noreferrer"
            target="_blank"
            title="Открыть файл на GitHub"
          >
            <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
          </a>
        </div>
      </div>

      <pre
        aria-label={`Код ${fileName}`}
        className={cn(
          'scroll-area m-0 overflow-auto bg-bg/70 py-2 font-mono text-caption leading-[1.75]',
          maxHeightClass,
        )}
        tabIndex={0}
      >
        <code className="block min-w-max">
          <Highlight
            code={code}
            language={language}
            prism={Prism}
            theme={CODE_THEME}
          >
            {({ tokens, getLineProps, getTokenProps }) =>
              tokens.map((line, lineIndex) => {
                const lineProps = getLineProps({ line });

                return (
                  <span className="flex" key={lineIndex}>
                    <span
                      aria-hidden="true"
                      className="sticky left-0 w-10 shrink-0 select-none border-r border-line/50 bg-bg/90 pr-2 text-right text-micro text-muted/70"
                    >
                      {startLine + lineIndex}
                    </span>
                    <span
                      {...lineProps}
                      className={cn(
                        'whitespace-pre px-3 text-text/90',
                        lineProps.className,
                      )}
                    >
                      {line.map((token, tokenIndex) => (
                        <span
                          {...getTokenProps({ token })}
                          key={tokenIndex}
                        />
                      ))}
                    </span>
                  </span>
                );
              })
            }
          </Highlight>
        </code>
      </pre>

      <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-1.5">
        <span className="truncate font-mono text-micro text-muted/70">
          {filePath}
        </span>
        <span className="shrink-0 font-mono text-micro text-muted/70">
          {language}
        </span>
      </div>
    </div>
  );
}
