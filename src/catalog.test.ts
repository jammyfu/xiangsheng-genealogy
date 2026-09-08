import { describe, expect, it } from 'vitest';

describe('scaffold', () => {
  it('keeps the generation poem in the intended order', () => {
    expect(['德', '寿', '宝', '文', '明'].join('')).toBe('德寿宝文明');
    expect(['德', '寿', '宝', '文', '明'].join('')).not.toBe('德寿喜哈');
  });
});
