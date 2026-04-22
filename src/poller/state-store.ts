import fs from 'fs';
import path from 'path';
import type { Logger } from '../shared/logger.js';

export interface ChannelStateEntry {
  lastMessageId: number;
}

export type ChannelState = Record<string, ChannelStateEntry>;

export function loadState(filePath: string, logger: Logger): ChannelState {
  try {
    if (!fs.existsSync(filePath)) {
      logger.info(`State file not found at ${filePath}, starting with empty state`);
      return {};
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      logger.warn(`Invalid state format in ${filePath}, starting with empty state`);
      return {};
    }

    return parsed as ChannelState;
  } catch (error) {
    logger.error(`Failed to load state: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

export function saveState(filePath: string, state: ChannelState, logger: Logger): void {
  const dir = path.dirname(filePath);
  const tmpPath = `${filePath}.tmp`;

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      // ignore cleanup errors
    }
    logger.error(`Failed to save state: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
