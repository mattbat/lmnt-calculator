import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from '../hooks/useWakeLock';

const pwa = vi.hoisted(() => ({ needRefresh: true }));
vi.mock('virtual:pwa-register/react', async () => {
  const { useState } = await import('react');
  return {
    useRegisterSW: () => {
      const [needRefresh, setNeedRefresh] = useState(pwa.needRefresh);
      return { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker: vi.fn() };
    },
  };
});

const { UpdateBanner, inMixingMode } = await import('./UpdateBanner');
const { ErrorBanner } = await import('./ErrorBanner');
const { InstallHint } = await import('./InstallHint');
const { lastError } = await import('../errorLog');

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
  pwa.needRefresh = true;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ErrorBanner', () => {
  it('shows unhandled errors and can be dismissed', async () => {
    const user = userEvent.setup();
    render(<ErrorBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.assign(rejection, { reason: new Error('Storage is full') });
    act(() => {
      window.dispatchEvent(rejection);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Storage is full');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'Oops', error: new Error('Oops') }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Oops');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    // An error in one of our own files, even without the error object.
    act(() => {
      window.dispatchEvent(
        new ErrorEvent('error', { message: 'Bad thing', filename: `${location.origin}/lmnt-calculator/assets/index.js` }),
      );
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Bad thing');
  });

  it('ignores errors from other sites’ scripts, but notes them', () => {
    render(<ErrorBanner />);
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));
      window.dispatchEvent(
        new ErrorEvent('error', {
          message: 'TypeError: undefined is not an object',
          filename: 'safari-web-extension://abc/content.js',
        }),
      );
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(lastError()).toMatchObject({ shown: false, source: 'safari-web-extension://abc/content.js' });
  });

  it('copes with storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<ErrorBanner />);
    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'Oops', error: new Error('Oops') }));
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(lastError()).toBeNull();
  });
});

describe('UpdateBanner (T7)', () => {
  it('offers the update, and applies it only when asked', async () => {
    const user = userEvent.setup();
    const update = vi.fn().mockResolvedValue(undefined);
    render(<UpdateBanner update={update} />);
    expect(screen.getByRole('status')).toHaveTextContent('A new version of LMNT Calculator is ready.');
    expect(update).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled();
  });

  it('can be put off with Later', async () => {
    const user = userEvent.setup();
    render(<UpdateBanner update={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows nothing when there is no update, or while mixing', () => {
    pwa.needRefresh = false;
    const { unmount } = render(<UpdateBanner update={vi.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    unmount();
    pwa.needRefresh = true;
    window.location.hash = '#/mix/watermelon';
    render(<UpdateBanner update={vi.fn()} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('knows which routes are mixing mode', () => {
    expect(inMixingMode('#/mix')).toBe(true);
    expect(inMixingMode('#/mix/abc')).toBe(true);
    expect(inMixingMode('#/mixture')).toBe(false);
    expect(inMixingMode('#/')).toBe(false);
  });
});

describe('InstallHint', () => {
  it('explains how to install in the browser, and stays dismissed', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<InstallHint />);
    expect(screen.getByText(/Add LMNT Calculator to your Home Screen/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    unmount();
    render(<InstallHint />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('is hidden in the installed app', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    render(<InstallHint />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('still shows and hides when storage is unavailable', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<InstallHint />);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});

describe('useWakeLock', () => {
  function stubWakeLock() {
    const sentinel = Object.assign(new EventTarget(), { release: vi.fn().mockResolvedValue(undefined) });
    const request = vi.fn().mockResolvedValue(sentinel);
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { wakeLock: { request } }));
    return { sentinel, request };
  }

  it('holds the lock while active and releases it afterwards', async () => {
    const { sentinel, request } = stubWakeLock();
    const { result, unmount } = renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(result.current).toBe(true));
    expect(request).toHaveBeenCalledWith('screen');
    act(() => {
      sentinel.dispatchEvent(new Event('release'));
    });
    expect(result.current).toBe(false);
    unmount();
    expect(sentinel.release).toHaveBeenCalled();
  });

  it('asks again when the app becomes visible', async () => {
    const { request } = stubWakeLock();
    renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it('does nothing when inactive, unsupported, or refused', async () => {
    const { request } = stubWakeLock();
    const { result } = renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
    request.mockRejectedValue(new Error('denied'));
    const refused = renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    expect(refused.result.current).toBe(false);
    vi.unstubAllGlobals();
    vi.stubGlobal('navigator', {});
    expect(renderHook(() => useWakeLock(true)).result.current).toBe(false);
  });

  it('releases a lock that arrives after the screen was left', async () => {
    const { sentinel, request } = stubWakeLock();
    let resolve!: (value: unknown) => void;
    request.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = renderHook(() => useWakeLock(true));
    unmount();
    resolve(sentinel);
    await vi.waitFor(() => expect(sentinel.release).toHaveBeenCalled());
  });
});
