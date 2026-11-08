/**
 * Full-screen height for the installed iPhone app.
 *
 * When an iPhone Home Screen app launches, iOS can report every CSS viewport
 * height (100%, vh, dvh, lvh, innerHeight) about a status bar's height short
 * until the page is scrolled or rotated, so the app frame ends above the bottom
 * edge and the tab bar is cut off or floats. The physical screen size is always
 * right, and an installed iPhone app always fills the whole screen, so there we
 * size the frame from `screen` instead (--app-h, used in styles.css).
 *
 * Only iOS sets `navigator.standalone`, so Android (where the screen size
 * includes the system bars) and browser tabs keep the CSS sizing.
 */

type StandaloneNavigator = { standalone?: boolean };

/** The app's full height in CSS px, or undefined when the CSS sizing is right. */
export function iosAppHeight(
  nav: StandaloneNavigator = navigator as StandaloneNavigator,
  scr: Pick<Screen, 'width' | 'height'> = screen,
  landscape: boolean = window.matchMedia?.('(orientation: landscape)').matches ?? false,
): number | undefined {
  if (nav.standalone !== true) return undefined;
  const long = Math.max(scr.width, scr.height);
  const short = Math.min(scr.width, scr.height);
  if (!long || !short) return undefined;
  return landscape ? short : long;
}

/** Sets --app-h now and whenever the phone rotates or the window resizes. */
export function fitIosAppHeight(): void {
  const apply = () => {
    const h = iosAppHeight();
    if (h === undefined) document.documentElement.style.removeProperty('--app-h');
    else document.documentElement.style.setProperty('--app-h', `${h}px`);
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
}
