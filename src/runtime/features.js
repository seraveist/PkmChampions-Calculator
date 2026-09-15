// Module registry for optional pages. Core code never statically imports a
// feature implementation, preserving actual network-level lazy loading.
export const featureApis = Object.create(null);
const loaders = new Map();
const pending = new Map();
export function configurePageFeatures(entries) {
  for (const [key, load] of Object.entries(entries)) loaders.set(key, load);
}
export function pageFeatureNeedsLoad(key) {
  return loaders.has(key) && !featureApis[key];
}
export function loadPageFeature(key) {
  if (!loaders.has(key) || featureApis[key]) return Promise.resolve();
  if (pending.has(key)) return pending.get(key);
  const promise = loaders.get(key)().then(module => {
    module.initialize();
    featureApis[key] = module.api;
  }).catch(error => {
    pending.delete(key);
    throw error;
  });
  pending.set(key, promise);
  return promise;
}
