import type { GameState } from './types';
import { newState } from './state';

/** Single mutable holder so ascension / import can swap the whole state object. */
export const game: { s: GameState } = { s: newState() };
