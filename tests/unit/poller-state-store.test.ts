import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadState, saveState } from '../../src/poller/state-store.js';
import fs from 'fs';
import path from 'path';

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const testFilePath = path.join(__dirname, 'test-state.json');

afterEach(() => {
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }
  if (fs.existsSync(`${testFilePath}.tmp`)) {
    fs.unlinkSync(`${testFilePath}.tmp`);
  }
  vi.clearAllMocks();
});

describe('loadState', () => {
  it('should return empty object when file does not exist', () => {
    const result = loadState(testFilePath, mockLogger);

    expect(result).toEqual({});
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('State file not found'),
    );
  });

  it('should load existing state correctly', () => {
    const state = { channel1: { lastMessageId: 42 }, channel2: { lastMessageId: 100 } };
    fs.writeFileSync(testFilePath, JSON.stringify(state), 'utf-8');

    const result = loadState(testFilePath, mockLogger);

    expect(result).toEqual(state);
  });

  it('should handle malformed JSON gracefully', () => {
    fs.writeFileSync(testFilePath, 'not valid json', 'utf-8');

    const result = loadState(testFilePath, mockLogger);

    expect(result).toEqual({});
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load state'),
    );
  });

  it('should handle array JSON gracefully', () => {
    fs.writeFileSync(testFilePath, '[]', 'utf-8');

    const result = loadState(testFilePath, mockLogger);

    expect(result).toEqual({});
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid state format'),
    );
  });

  it('should handle null JSON gracefully', () => {
    fs.writeFileSync(testFilePath, 'null', 'utf-8');

    const result = loadState(testFilePath, mockLogger);

    expect(result).toEqual({});
  });
});

describe('saveState', () => {
  it('should save state atomically', () => {
    const state = { channel1: { lastMessageId: 42 } };

    saveState(testFilePath, state, mockLogger);

    expect(fs.existsSync(testFilePath)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(testFilePath, 'utf-8'));
    expect(saved).toEqual(state);
    expect(fs.existsSync(`${testFilePath}.tmp`)).toBe(false);
  });

  it('should create directory if it does not exist', () => {
    const nestedPath = path.join(__dirname, 'nested', 'dir', 'test-state.json');
    const state = { channel1: { lastMessageId: 42 } };

    try {
      saveState(nestedPath, state, mockLogger);

      expect(fs.existsSync(nestedPath)).toBe(true);
      const saved = JSON.parse(fs.readFileSync(nestedPath, 'utf-8'));
      expect(saved).toEqual(state);
    } finally {
      if (fs.existsSync(nestedPath)) {
        fs.unlinkSync(nestedPath);
      }
      const dirPath = path.join(__dirname, 'nested', 'dir');
      if (fs.existsSync(dirPath)) {
        fs.rmdirSync(dirPath);
      }
      const nestedDirPath = path.join(__dirname, 'nested');
      if (fs.existsSync(nestedDirPath)) {
        fs.rmdirSync(nestedDirPath);
      }
    }
  });
});
