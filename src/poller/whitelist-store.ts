import fs from 'fs';
import path from 'path';
import type { Logger } from '../shared/logger.js';

function normalizeChannel(channel: string): string {
  return channel.replace(/^@/, '').trim().toLowerCase();
}

export function loadChannels(filePath: string, logger: Logger): string[] {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    return lines;
  } catch (error) {
    logger.error(
      `Failed to load channels: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

export function addChannel(filePath: string, channel: string, logger: Logger): boolean {
  const normalized = normalizeChannel(channel);
  const channels = loadChannels(filePath, logger);

  if (channels.includes(normalized)) {
    return false;
  }

  channels.push(normalized);
  saveChannels(filePath, channels, logger);
  return true;
}

export function removeChannel(filePath: string, channel: string, logger: Logger): boolean {
  const normalized = normalizeChannel(channel);
  const channels = loadChannels(filePath, logger);
  const index = channels.indexOf(normalized);

  if (index === -1) {
    return false;
  }

  channels.splice(index, 1);
  saveChannels(filePath, channels, logger);
  return true;
}

function saveChannels(filePath: string, channels: string[], logger: Logger): void {
  const dir = path.dirname(filePath);
  const tmpPath = `${filePath}.tmp`;

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(tmpPath, channels.join('\n') + (channels.length > 0 ? '\n' : ''), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      // ignore cleanup errors
    }
    logger.error(
      `Failed to save channels: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}
