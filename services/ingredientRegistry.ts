import { Ingredient } from '../types';
import { INGREDIENTS } from '../constants';

/* =============================================================================
   ONE LOOKUP FOR EVERY INGREDIENT, BOUGHT OR MADE

   The critic, the alcohol check, the tasting notes and the feedback all looked
   ingredients up in INGREDIENTS alone, so anything the player MADE — a strain
   of spore, a finished koji, a tomato grown on the estate — was invisible to
   them: its quality never reached the terroir cap, and a mead of estate apples
   was scored as if the fruit were not in it. Those functions do not receive the
   game state, so the App registers the custom list here every render (an
   identity check makes that free) and they read through `findIngredient`.
   ============================================================================= */

let custom: Ingredient[] | null = null;
let byId = new Map<string, Ingredient>(INGREDIENTS.map(i => [i.id, i]));

export const registerCustomIngredients = (list: Ingredient[] | undefined): void => {
  const next = list ?? [];
  if (next === custom) return;
  custom = next;
  byId = new Map<string, Ingredient>([...INGREDIENTS, ...next].map(i => [i.id, i]));
};

export const findIngredient = (id: string): Ingredient | undefined => byId.get(id);
