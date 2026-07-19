export const CSS_LAYER_ORDER = [
  'reset',
  'tokens',
  'base',
  'components',
  'layouts',
  'pages',
  'utilities',
  'themes',
  'responsive',
];

const CSS_FILE_LAYERS = new Map([
  ['02-pages.css', 'base'],
]);

export function styleLayerFor(relativePath) {
  if (relativePath === '00-tokens.css' || relativePath.startsWith('tokens/')) return 'tokens';
  if (relativePath === '01-reset.css') return 'reset';
  if (relativePath === '02-base.css') return 'base';
  // Responsive contracts must always win over their desktop component/page
  // owners. This semantic mapping avoids relying on alphabetical filenames.
  if (relativePath === 'responsive.css' || relativePath.endsWith('-responsive.css')) return 'responsive';
  if (relativePath.startsWith('components/')) return 'components';
  if (relativePath.startsWith('layouts/')) return 'layouts';
  if (relativePath.startsWith('pages/')) return 'pages';
  if (relativePath === 'utilities.css') return 'utilities';
  if (relativePath === 'themes.css') return 'themes';
  const mappedLayer = CSS_FILE_LAYERS.get(relativePath);
  if (mappedLayer) return mappedLayer;
  throw new Error(`CSS layer ownership is not declared: ${relativePath}`);
}
