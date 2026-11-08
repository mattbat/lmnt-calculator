import { useEffect, useState } from 'react';
import { encodeRecipeLink } from '../data/recipeLink';
import { shareLink } from '../data/share';
import type { Ingredient, Recipe } from '../types';
import { Sheet } from './ui';

/** SH1, SH2: builds the recipe link, shows it, and hands it to the share sheet or the clipboard. */
export function ShareSheet({
  recipe,
  ingredients,
  onClose,
}: {
  recipe: Recipe;
  ingredients: Ingredient[];
  onClose: () => void;
}) {
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let alive = true;
    encodeRecipeLink(recipe, ingredients)
      .then((url) => alive && setLink(url))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Could not make the link.'));
    return () => {
      alive = false;
    };
  }, [recipe, ingredients]);

  const share = async () => {
    const outcome = await shareLink(link, `${recipe.name} electrolyte mix`, `My ${recipe.name} recipe for LMNT Calculator`);
    setMessage(
      outcome === 'copied'
        ? 'Link copied. Paste it into a message.'
        : outcome === 'failed'
          ? 'Could not share. Select the link above and copy it.'
          : outcome === 'shared'
            ? 'Shared.'
            : '',
    );
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Link copied.');
    } catch {
      setMessage('Could not copy. Select the link above and copy it.');
    }
  };

  return (
    <Sheet title="Share recipe" onClose={onClose}>
      <p>
        This link opens <strong>{recipe.name}</strong> ready to add. It holds the recipe and ingredient details but no
        prices, and it never goes to a server.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : (
        <textarea className="link-box" readOnly aria-label="Recipe link" rows={4} value={link} onFocus={(e) => e.target.select()} />
      )}
      <div className="actions">
        <button type="button" className="btn" disabled={!link} onClick={() => void share()}>
          Share link
        </button>
        <button type="button" className="btn ghost" disabled={!link} onClick={() => void copy()}>
          Copy link
        </button>
      </div>
      {message && (
        <p className="hint" role="status">
          {message}
        </p>
      )}
    </Sheet>
  );
}
