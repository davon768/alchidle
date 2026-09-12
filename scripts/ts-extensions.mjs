/**
 * Node ESM resolve hook that accepts the extensionless relative imports Vite allows
 * (`./ascension` → `./ascension.ts`), so the game's core can run under plain Node.
 * Used by the balance bot; see scripts/balance-bot.ts.
 */
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) throw err;
    for (const suffix of ['.ts', '/index.ts']) {
      try {
        return await next(specifier + suffix, context);
      } catch {
        /* try the next shape */
      }
    }
    throw err;
  }
}
