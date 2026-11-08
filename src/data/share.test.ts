import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareFile, shareLink } from './share';

const abort = () => new DOMException('cancelled', 'AbortError');

function stub(nav: Record<string, unknown>) {
  vi.stubGlobal('navigator', nav);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('shareFile', () => {
  it('uses the share sheet when files can be shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stub({ canShare: () => true, share });
    expect(await shareFile('backup.json', '{}')).toBe('shared');
    expect(share).toHaveBeenCalled();
  });

  it('reports a closed share sheet as cancelled', async () => {
    stub({ canShare: () => true, share: vi.fn().mockRejectedValue(abort()) });
    expect(await shareFile('backup.json', '{}')).toBe('cancelled');
  });

  it('downloads the file when sharing is unavailable or fails', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    stub({});
    expect(await shareFile('backup.json', '{}')).toBe('downloaded');
    stub({ canShare: () => true, share: vi.fn().mockRejectedValue(new Error('boom')) });
    expect(await shareFile('backup.json', '{}')).toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(2);
  });
});

describe('shareLink', () => {
  it('shares, copies, or reports failure', async () => {
    stub({ share: vi.fn().mockResolvedValue(undefined) });
    expect(await shareLink('https://x', 'T', 'text')).toBe('shared');

    stub({ share: vi.fn().mockRejectedValue(abort()) });
    expect(await shareLink('https://x', 'T', 'text')).toBe('cancelled');

    const writeText = vi.fn().mockResolvedValue(undefined);
    stub({ clipboard: { writeText } });
    expect(await shareLink('https://x', 'T', 'text')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://x');

    stub({ share: vi.fn().mockRejectedValue(new Error('boom')), clipboard: { writeText } });
    expect(await shareLink('https://x', 'T', 'text')).toBe('copied');

    stub({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    expect(await shareLink('https://x', 'T', 'text')).toBe('failed');
  });
});
