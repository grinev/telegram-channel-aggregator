import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadChannels, addChannel, removeChannel } from '../../src/poller/whitelist-store.js';
import fs from 'fs';
import path from 'path';

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const testFilePath = path.join(__dirname, 'test-channels.txt');

afterEach(() => {
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }
  if (fs.existsSync(`${testFilePath}.tmp`)) {
    fs.unlinkSync(`${testFilePath}.tmp`);
  }
  vi.clearAllMocks();
});

describe('loadChannels', () => {
  it('should return empty array when file does not exist', () => {
    const result = loadChannels(testFilePath, mockLogger);

    expect(result).toEqual([]);
  });

  it('should load channels correctly', () => {
    fs.writeFileSync(testFilePath, 'channel1\nchannel2\nchannel3\n', 'utf-8');

    const result = loadChannels(testFilePath, mockLogger);

    expect(result).toEqual(['channel1', 'channel2', 'channel3']);
  });

  it('should handle empty file', () => {
    fs.writeFileSync(testFilePath, '', 'utf-8');

    const result = loadChannels(testFilePath, mockLogger);

    expect(result).toEqual([]);
  });

  it('should skip empty lines', () => {
    fs.writeFileSync(testFilePath, 'channel1\n\nchannel2\n\n', 'utf-8');

    const result = loadChannels(testFilePath, mockLogger);

    expect(result).toEqual(['channel1', 'channel2']);
  });

  it('should handle read errors gracefully', () => {
    fs.writeFileSync(testFilePath, 'channel1', 'utf-8');

    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = loadChannels(testFilePath, mockLogger);

    expect(result).toEqual([]);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load channels'),
    );

    readSpy.mockRestore();
  });
});

describe('addChannel', () => {
  it('should add new channel and return true', () => {
    const result = addChannel(testFilePath, 'channel1', mockLogger);

    expect(result).toBe(true);
    const channels = loadChannels(testFilePath, mockLogger);
    expect(channels).toEqual(['channel1']);
  });

  it('should return false for duplicate channel', () => {
    addChannel(testFilePath, 'channel1', mockLogger);

    const result = addChannel(testFilePath, 'channel1', mockLogger);

    expect(result).toBe(false);
  });

  it('should strip @ prefix', () => {
    addChannel(testFilePath, '@channel1', mockLogger);

    const channels = loadChannels(testFilePath, mockLogger);

    expect(channels).toEqual(['channel1']);
  });

  it('should create file if it does not exist', () => {
    expect(fs.existsSync(testFilePath)).toBe(false);

    addChannel(testFilePath, 'channel1', mockLogger);

    expect(fs.existsSync(testFilePath)).toBe(true);
  });

  it('should append to existing channels', () => {
    addChannel(testFilePath, 'channel1', mockLogger);
    addChannel(testFilePath, 'channel2', mockLogger);

    const channels = loadChannels(testFilePath, mockLogger);

    expect(channels).toEqual(['channel1', 'channel2']);
  });

  it('should normalize channel to lowercase', () => {
    addChannel(testFilePath, 'Channel1', mockLogger);

    const channels = loadChannels(testFilePath, mockLogger);

    expect(channels).toEqual(['channel1']);
  });

  it('should not leave tmp file after save', () => {
    addChannel(testFilePath, 'channel1', mockLogger);

    expect(fs.existsSync(`${testFilePath}.tmp`)).toBe(false);
  });
});

describe('removeChannel', () => {
  it('should remove channel and return true', () => {
    addChannel(testFilePath, 'channel1', mockLogger);
    addChannel(testFilePath, 'channel2', mockLogger);

    const result = removeChannel(testFilePath, 'channel1', mockLogger);

    expect(result).toBe(true);
    const channels = loadChannels(testFilePath, mockLogger);
    expect(channels).toEqual(['channel2']);
  });

  it('should return false if channel not found', () => {
    addChannel(testFilePath, 'channel1', mockLogger);

    const result = removeChannel(testFilePath, 'channel2', mockLogger);

    expect(result).toBe(false);
  });

  it('should strip @ prefix when removing', () => {
    addChannel(testFilePath, 'channel1', mockLogger);

    const result = removeChannel(testFilePath, '@channel1', mockLogger);

    expect(result).toBe(true);
    const channels = loadChannels(testFilePath, mockLogger);
    expect(channels).toEqual([]);
  });

  it('should not leave tmp file after save', () => {
    addChannel(testFilePath, 'channel1', mockLogger);
    removeChannel(testFilePath, 'channel1', mockLogger);

    expect(fs.existsSync(`${testFilePath}.tmp`)).toBe(false);
  });
});
