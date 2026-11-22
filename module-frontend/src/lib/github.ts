export const GITHUB_REPO_URL =
  'https://github.com/baileyseye/oracle-to-postgres';

export function githubBlobUrl(path: string): string {
  return `${GITHUB_REPO_URL}/blob/master/${path}`;
}

export function githubTreeUrl(path: string): string {
  return `${GITHUB_REPO_URL}/tree/master/${path}`;
}
