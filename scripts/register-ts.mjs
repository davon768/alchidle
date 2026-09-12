/** Installs the extensionless-import resolver (see ts-extensions.mjs) for `node --import`. */
import { register } from 'node:module';
register('./ts-extensions.mjs', import.meta.url);
