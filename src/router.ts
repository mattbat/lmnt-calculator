import { useEffect, useState } from 'react';

/**
 * Tiny hash router. GitHub Pages can't fall back to index.html for deep
 * links, so routes live after the # (REQUIREMENTS.md T3).
 *
 * Shared recipe links look like `#r=<data>` (SH1) and are routed to `receive`.
 * Mixing mode lives at `#/mix/<recipeId>`; the update banner is held back there (T7).
 */

export type TabName = 'recipes' | 'log' | 'ingredients' | 'more';

export type Route =
  | { name: TabName }
  | { name: 'receive'; data: string }
  | { name: 'recipe'; id: string }
  | { name: 'recipeEdit'; id: string }
  | { name: 'mix'; id: string }
  | { name: 'logEntry'; id: string }
  | { name: 'settings' }
  | { name: 'about' }
  | { name: 'help' };

function decode(part: string | undefined): string {
  try {
    return decodeURIComponent(part ?? '');
  } catch {
    return '';
  }
}

export function parseRoute(hash: string): Route {
  if (hash.startsWith('#r=') && hash.length > 3) return { name: 'receive', data: hash.slice(3) };
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const id = decode(parts[1]);
  switch (parts[0]) {
    case 'log':
      return id ? { name: 'logEntry', id } : { name: 'log' };
    case 'ingredients':
      return { name: 'ingredients' };
    case 'recipe':
      if (!id) return { name: 'recipes' };
      return parts[2] === 'edit' ? { name: 'recipeEdit', id } : { name: 'recipe', id };
    case 'mix':
      return id ? { name: 'mix', id } : { name: 'recipes' };
    case 'more':
      if (parts[1] === 'settings') return { name: 'settings' };
      if (parts[1] === 'about') return { name: 'about' };
      if (parts[1] === 'help') return { name: 'help' };
      return { name: 'more' };
    default:
      return { name: 'recipes' };
  }
}

export const paths = {
  recipes: () => '#/',
  log: () => '#/log',
  ingredients: () => '#/ingredients',
  more: () => '#/more',
  receive: (data: string) => `#r=${data}`,
  recipe: (id: string) => `#/recipe/${encodeURIComponent(id)}`,
  recipeEdit: (id: string) => `#/recipe/${encodeURIComponent(id)}/edit`,
  newRecipe: () => '#/recipe/new/edit',
  mix: (id: string) => `#/mix/${encodeURIComponent(id)}`,
  logEntry: (id: string) => `#/log/${encodeURIComponent(id)}`,
  settings: () => '#/more/settings',
  about: () => '#/more/about',
  help: () => '#/more/help',
};

/** Which bottom tab a route belongs to. */
export function tabFor(route: Route): TabName {
  switch (route.name) {
    case 'receive':
    case 'recipe':
    case 'recipeEdit':
    case 'mix':
      return 'recipes';
    case 'logEntry':
      return 'log';
    case 'settings':
    case 'about':
    case 'help':
      return 'more';
    default:
      return route.name;
  }
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
