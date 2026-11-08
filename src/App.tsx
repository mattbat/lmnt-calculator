import { useEffect } from 'react';
import { DisclaimerGate } from './components/DisclaimerGate';
import { Loading } from './components/ui';
import { requestPersistentStorage } from './data/db';
import { useSettings } from './data/repo';
import { CalculatorScreen } from './screens/CalculatorScreen';
import { AboutScreen, HelpScreen, MoreScreen } from './screens/InfoScreens';
import { IngredientsScreen } from './screens/IngredientsScreen';
import { LogEntryScreen } from './screens/LogEntryScreen';
import { LogScreen } from './screens/LogScreen';
import { MixingScreen } from './screens/MixingScreen';
import { RecipesScreen } from './screens/RecipesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { paths, tabFor, useRoute, type Route, type TabName } from './router';
import { setThemePreference } from './theme';

const TABS: { name: TabName; label: string; icon: string }[] = [
  { name: 'recipes', label: 'Recipes', icon: '🧪' },
  { name: 'log', label: 'Log', icon: '📒' },
  { name: 'ingredients', label: 'Ingredients', icon: '🧂' },
  { name: 'more', label: 'More', icon: '⋯' },
];

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'recipes':
      return <RecipesScreen />;
    case 'recipe':
      return <CalculatorScreen id={route.id} />;
    case 'mix':
      return <MixingScreen id={route.id} />;
    case 'log':
      return <LogScreen />;
    case 'logEntry':
      return <LogEntryScreen id={route.id} />;
    case 'ingredients':
      return <IngredientsScreen />;
    case 'more':
      return <MoreScreen />;
    case 'settings':
      return <SettingsScreen />;
    case 'about':
      return <AboutScreen />;
    case 'help':
      return <HelpScreen />;
  }
}

/** The app shell: the current screen, the first-launch notice (D1) and the bottom tab bar (§9). */
export function App() {
  const route = useRoute();
  const settings = useSettings();
  const tab = tabFor(route);
  const theme = settings?.theme;

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  // The theme lives in settings (and so in backups); a copy in localStorage lets index.html pick it before load.
  useEffect(() => {
    if (theme) setThemePreference(theme === 'system' ? 'auto' : theme);
  }, [theme]);

  if (!settings) {
    return (
      <div className="app">
        <main className="screen">
          <Loading />
        </main>
      </div>
    );
  }
  if (settings.disclaimerAcceptedAt === undefined) {
    return (
      <div className="app">
        <DisclaimerGate />
      </div>
    );
  }

  return (
    <div className="app">
      <Screen route={route} />
      {route.name !== 'mix' && (
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
      )}
    </div>
  );
}
