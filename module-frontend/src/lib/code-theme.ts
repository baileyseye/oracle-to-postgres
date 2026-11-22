import type { PrismTheme } from 'prism-react-renderer';

export const CODE_THEME: PrismTheme = {
  plain: {
    color: '#e8eef9',
    backgroundColor: 'transparent',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: { color: '#6b7c9a', fontStyle: 'italic' },
    },
    {
      types: ['punctuation'],
      style: { color: '#a8b8d4' },
    },
    {
      types: ['keyword', 'selector', 'important', 'atrule', 'builtin'],
      style: { color: '#f472b6' },
    },
    {
      types: ['string', 'char', 'attr-value', 'regex'],
      style: { color: '#38bdf8' },
    },
    {
      types: ['number', 'boolean', 'constant', 'symbol'],
      style: { color: '#fbbf24' },
    },
    {
      types: ['function', 'class-name', 'annotation'],
      style: { color: '#c4b5fd' },
    },
    {
      types: ['operator', 'entity', 'url'],
      style: { color: '#93c4e8' },
    },
    {
      types: ['variable', 'property', 'tag'],
      style: { color: '#e8eef9' },
    },
    {
      types: ['deleted'],
      style: { color: '#f87171' },
    },
    {
      types: ['inserted'],
      style: { color: '#34d399' },
    },
  ],
};
