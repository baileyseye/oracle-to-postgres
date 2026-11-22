import type {
  CodeFile,
  CodeModule,
  CodeSnippet,
} from '../types/code';

export interface CodeSearchResult {
  readonly module: CodeModule;
  readonly file: CodeFile;
  readonly snippet: CodeSnippet;
}

function queryTokens(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function searchCode(
  modules: readonly CodeModule[],
  query: string,
): CodeSearchResult[] {
  const tokens = queryTokens(query);

  if (tokens.length === 0) {
    return [];
  }

  const results: CodeSearchResult[] = [];

  for (const module of modules) {
    for (const file of module.files) {
      const haystack = [
        module.label,
        module.port,
        module.summary,
        file.name,
        file.path,
        file.summary,
        ...file.snippets.flatMap((snippet) => [
          snippet.title,
          snippet.note,
          snippet.code,
        ]),
      ]
        .join('\n')
        .toLowerCase();

      if (tokens.every((token) => haystack.includes(token))) {
        const snippet = file.snippets[0];

        if (snippet) {
          results.push({ module, file, snippet });
        }
      }
    }
  }

  return results;
}
