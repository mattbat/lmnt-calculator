import { useEffect, useState } from 'react';

/**
 * Tiny hash router. GitHub Pages can't fall back to index.html for deep
 * links, so routes live after the # (REQUIREMENTS.md T3).
 *
 * Recipe pages live at `#/recipe/<id>`. Old `#r=` links fall through to the Recipes screen.
 * Mixing mode lives at `#/mix/<recipeId>`; the update banner is held back there (T7).
 */

export type TabName = 'recipes' | 'log' | 'ingredients' | 'more';

export type Route =
  | { name: TabName }
  | { name: 'recipe'; id: string }
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
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const id = decode(parts[1]);
  switch (parts[0]) {
    case 'log':
      return id ? { name: 'logEntry', id } : { name: 'log' };
    case 'ingredients':
      return { name: 'ingredients' };
    case 'recipe':
      if (!id) return { name: 'recipes' };
      return { name: 'recipe', id };
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
  recipe: (id: string) => `#/recipe/${encodeURIComponent(id)}`,
  mix: (id: string) => `#/mix/${encodeURIComponent(id)}`,
  logEntry: (id: string) => `#/log/${encodeURIComponent(id)}`,
  settings: () => '#/more/settings',
  about: () => '#/more/about',
  help: () => '#/more/help',
};

/** Which bottom tab a route belongs to. */
export function tabFor(route: Route): TabName {
  switch (route.name) {
    case 'recipe':
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
