import { describe, it, expect } from 'vitest';
import { Deduplicator } from '../../src/poller/deduplicator.js';

describe('Deduplicator', () => {
  it('should initialize with empty state by default', () => {
    const deduplicator = new Deduplicator();
    expect(deduplicator.getKeys()).toEqual([]);
  });

  it('should initialize with provided keys up to capacity', () => {
    const keys = Array.from({ length: 15 }, (_, i) => `key:${i}`);
    const deduplicator = new Deduplicator(10, keys);

    expect(deduplicator.getKeys().length).toBe(10);
    expect(deduplicator.getKeys()[0]).toBe('key:5');
    expect(deduplicator.getKeys()[9]).toBe('key:14');
  });

  it('should identify duplicates correctly', () => {
    const deduplicator = new Deduplicator(10, ['key:1', 'key:2']);

    expect(deduplicator.isDuplicate('key:1')).toBe(true);
    expect(deduplicator.isDuplicate('key:2')).toBe(true);
    expect(deduplicator.isDuplicate('key:3')).toBe(false);
  });

  it('should add new keys up to capacity and shift oldest', () => {
    const deduplicator = new Deduplicator(3);

    deduplicator.add('key:1');
    deduplicator.add('key:2');
    deduplicator.add('key:3');
    expect(deduplicator.getKeys()).toEqual(['key:1', 'key:2', 'key:3']);

    deduplicator.add('key:4');
    expect(deduplicator.getKeys()).toEqual(['key:2', 'key:3', 'key:4']);
    expect(deduplicator.isDuplicate('key:1')).toBe(false);
    expect(deduplicator.isDuplicate('key:4')).toBe(true);
  });

  it('should not add duplicate keys again', () => {
    const deduplicator = new Deduplicator(3);

    deduplicator.add('key:1');
    deduplicator.add('key:2');
    deduplicator.add('key:1');

    expect(deduplicator.getKeys()).toEqual(['key:1', 'key:2']);
  });
});
