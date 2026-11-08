import { useEffect, useState } from 'react';

/**
 * Tiny hash router. GitHub Pages can't fall back to index.html for deep
 * links, so routes live after the # (REQUIREMENTS.md T3).
 *
 * Shared recipe links look like `#r=<data>` (SH1) and are routed to `receive`.
 * Later phases add more routes (calculator, mixing mode, editors) here.
 */

export type TabName = 'recipes' | 'log' | 'ingredients' | 'more';

export type Route = { name: TabName } | { name: 'receive'; data: string };

export function parseRoute(hash: string): Route {
  if (hash.startsWith('#r=') && hash.length > 3) return { name: 'receive', data: hash.slice(3) };
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'log':
    case 'ingredients':
    case 'more':
      return { name: parts[0] };
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
};

/** Which bottom tab a route belongs to. */
export function tabFor(route: Route): TabName {
  return route.name === 'receive' ? 'recipes' : route.name;
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
