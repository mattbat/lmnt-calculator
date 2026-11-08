import { Section, TopBar } from '../components/ui';
import { paths } from '../router';

export const LMNT_ARTICLE =
  'https://science.drinklmnt.com/electrolytes/best-homemade-electrolyte-drink-for-dehydration';
export const LMNT_SHOP = 'https://drinklmnt.com';

/** More (§9): links to Settings, About and Help. */
export function MoreScreen() {
  return (
    <main className="screen">
      <h1>More</h1>
      <ul className="cards menu">
        <li>
          <a className="card" href={paths.settings()}>
            <span className="line-name">Settings</span>
            <span className="muted small">Units, scale, prices, theme, backup and restore</span>
          </a>
        </li>
        <li>
          <a className="card" href={paths.help()}>
            <span className="line-name">Help</span>
            <span className="muted small">Making a batch, mixing mode, sharing, backups</span>
          </a>
        </li>
        <li>
          <a className="card" href={paths.about()}>
            <span className="line-name">About</span>
            <span className="muted small">Credit, disclaimer, equipment</span>
          </a>
        </li>
      </ul>
    </main>
  );
}

/** About (D3, §9 screen 9). */
export function AboutScreen() {
  return (
    <main className="screen">
      <TopBar title="About" back={paths.more()} backLabel="Back to More" />
      <p>
        LMNT Calculator helps you scale and mix a homemade electrolyte drink powder, weigh it one ingredient at a
        time, and see what each serving costs. It is a personal, non-commercial project: no ads, no accounts, and
        nothing leaves your phone.
      </p>

      <Section title="Credit">
        <p>
          The base ratios come from the recipe LMNT published:{' '}
          <a href={LMNT_ARTICLE} target="_blank" rel="noopener noreferrer">
            the best homemade electrolyte drink for dehydration
          </a>
          .
        </p>
        <p>
          <a className="btn ghost" href={LMNT_SHOP} target="_blank" rel="noopener noreferrer">
            Buy the real thing
          </a>
        </p>
      </Section>

      <Section title="Disclaimer">
        <div id="disclaimer">
          <ul className="plain-list">
            <li>This is not medical advice. Each serving has about 1,000 mg of sodium.</li>
            <li>
              Check with a doctor first if you have kidney disease, high blood pressure, or heart failure, are pregnant,
              or take medication that affects potassium (for example ACE inhibitors, ARBs, or potassium-sparing
              diuretics).
            </li>
            <li>LMNT Calculator is not made by, endorsed by, or affiliated with LMNT. LMNT is a trademark of its owner.</li>
            <li>
              Store powders away from children. Concentrated potassium chloride is harmful in large amounts.
            </li>
            <li>You are responsible for your ingredients and your measurements.</li>
          </ul>
        </div>
      </Section>

      <Section title="Equipment">
        <p className="muted">Coming soon: the scale, vials and tools I use.</p>
      </Section>

      <p className="legal">Version {__APP_VERSION__}</p>
    </main>
  );
}

const TOPICS: { title: string; body: string[] }[] = [
  {
    title: 'Making a batch',
    body: [
      'Open a recipe from the Recipes tab and choose how to size your batch: by servings, by vials, or by the total weight of mix you want.',
      'The Weigh out list shows how many grams of each ingredient to measure. Tap Start mixing to be walked through it.',
      'Each serving is meant for 16–32 oz (about 0.5–1 L) of water.',
    ],
  },
  {
    title: 'Mixing mode',
    body: [
      'Mixing mode shows one ingredient at a time. Tare the scale, weigh to the target, then tap Done → next. Tap a number in the strip to jump back.',
      'You can type the actual weight if you like; it is saved in the log, and a difference over 5% gets a gentle flag.',
      'After the last ingredient: mix well, then fill the vials. Finish saves the batch to your log. The screen stays on while you mix, and mixing resumes where you left off if the phone locks.',
      'Tip: weigh on a dry day. Fruit powder and malic acid absorb moisture and clump. Use sealed vials and a food-safe desiccant pack.',
    ],
  },
  {
    title: 'Sharing a recipe',
    body: [
      'Open a recipe and tap Share recipe. The link holds the recipe and ingredient details but no prices, and it never goes to a server.',
      'Someone who opens the link sees a preview and can add it to their recipes. If you use the installed app, open the link in the browser, tap Copy for the LMNT Calculator app, then use Recipes → Paste recipe link in the app.',
    ],
  },
  {
    title: 'Backups',
    body: [
      'Your data lives only on this device. Go to More → Settings → Back up now to save a file through the share sheet or as a download.',
      'To restore, choose the backup file, review the summary, then choose Merge (keeps the newer copy of each item) or Replace all.',
      'You will see a reminder if you have logged batches and not backed up for 60 days.',
    ],
  },
  {
    title: 'Measuring by teaspoon',
    body: [
      'Weighing is more accurate. Powders vary in density, so teaspoon amounts are approximate.',
      'Turn on Show approximate teaspoons in Settings. For an ingredient with no teaspoon value, open it in Ingredients and use the Measure helper: level off 1 teaspoon, weigh it, and enter the weight.',
    ],
  },
  {
    title: 'Storage tips',
    body: [
      'Keep powders and mixed vials sealed, cool and dry, with a food-safe desiccant pack.',
      'Keep them away from children. Concentrated potassium chloride is harmful in large amounts.',
    ],
  },
];

/** Help (§9 screen 10). */
export function HelpScreen() {
  return (
    <main className="screen">
      <TopBar title="Help" back={paths.more()} backLabel="Back to More" />
      <div className="topics">
        {TOPICS.map((t) => (
          <details key={t.title} className="topic">
            <summary>{t.title}</summary>
            {t.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </details>
        ))}
      </div>
    </main>
  );
}
