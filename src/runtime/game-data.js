// Build adapter. Public output imports a hashed data module; the offline
// bundle leaves this undefined and uses readEmbeddedGameData(). Workers are
// built with the same module bound to their init message's data object.
export const PKM_DATA = undefined;
