import { Canvas, Conversation } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const requestJson = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};

export const fetchCanvases = async (): Promise<Canvas[]> => {
  const data = await requestJson<{ canvases?: Canvas[] }>('/api/storage/canvases');
  return Array.isArray(data.canvases) ? data.canvases : [];
};

export const saveCanvases = async (canvases: Canvas[]): Promise<void> => {
  await requestJson('/api/storage/canvases', {
    method: 'PUT',
    body: JSON.stringify({ canvases }),
  });
};

export const fetchConversations = async (): Promise<Conversation[]> => {
  const data = await requestJson<{ conversations?: Conversation[] }>('/api/storage/conversations');
  return Array.isArray(data.conversations) ? data.conversations : [];
};

export const saveConversations = async (conversations: Conversation[]): Promise<void> => {
  await requestJson('/api/storage/conversations', {
    method: 'PUT',
    body: JSON.stringify({ conversations }),
  });
};
