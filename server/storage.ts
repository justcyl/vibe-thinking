import { promises as fs } from 'fs';
import path from 'path';

interface StorageState {
  canvases: unknown[];
  conversations: unknown[];
}

const DEFAULT_STATE: StorageState = {
  canvases: [],
  conversations: [],
};

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORAGE_PATH = path.join(DATA_DIR, 'vibe-thinking.json');

const ensureStorageFile = async (): Promise<void> => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORAGE_PATH);
  } catch {
    await fs.writeFile(STORAGE_PATH, JSON.stringify(DEFAULT_STATE, null, 2));
  }
};

const readStorageFile = async (): Promise<StorageState> => {
  await ensureStorageFile();
  const raw = await fs.readFile(STORAGE_PATH, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return {
      canvases: Array.isArray(parsed?.canvases) ? parsed.canvases : [],
      conversations: Array.isArray(parsed?.conversations) ? parsed.conversations : [],
    };
  } catch (error) {
    console.error('Failed to parse storage file', error);
    return { ...DEFAULT_STATE };
  }
};

const writeStorageFile = async (state: StorageState): Promise<void> => {
  await ensureStorageFile();
  const tempPath = `${STORAGE_PATH}.tmp`;
  const payload = JSON.stringify(state, null, 2);
  await fs.writeFile(tempPath, payload);
  await fs.rename(tempPath, STORAGE_PATH);
};

export const getStorageState = async (): Promise<StorageState> => {
  return readStorageFile();
};

export const updateStorageState = async (partial: Partial<StorageState>): Promise<StorageState> => {
  const current = await readStorageFile();
  const next: StorageState = {
    canvases: partial.canvases ?? current.canvases,
    conversations: partial.conversations ?? current.conversations,
  };
  await writeStorageFile(next);
  return next;
};
