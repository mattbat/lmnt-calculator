import { InstallHint } from './components/InstallHint';
import { paths, tabFor, useRoute, type TabName } from './router';

const TABS: { name: TabName; label: string; icon: string }[] = [
  { name: 'recipes', label: 'Recipes', icon: '🧪' },
  { name: 'log', label: 'Log', icon: '📒' },
  { name: 'ingredients', label: 'Ingredients', icon: '🧂' },
  { name: 'more', label: 'More', icon: '⋯' },
];

const TITLES: Record<TabName, string> = {
  recipes: 'Recipes',
  log: 'Log',
  ingredients: 'Ingredients',
  more: 'More',
};

/** The app shell: a screen on top and the bottom tab bar (§9). Screens arrive in later phases. */
export function App() {
  const route = useRoute();
  const tab = tabFor(route);

  return (
    <div className="app">
      <main className="screen">
        <h1>{TITLES[tab]}</h1>
        {tab === 'recipes' && <InstallHint />}
        <p className="soon">Coming soon</p>
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <a
            key={t.name}
            href={paths[t.name]()}
            className={t.name === tab ? 'tab active' : 'tab'}
            aria-current={t.name === tab ? 'page' : undefined}
          >
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
