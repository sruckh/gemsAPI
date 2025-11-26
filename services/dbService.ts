import { Gem, AppConfig } from '../types';
import { getGemsWithAuth, createGemWithAuth, updateGemWithAuth, deleteGemWithAuth } from './authService';

// Mock data for local storage initialization
const INITIAL_GEMS: Gem[] = [
  {
    id: '1',
    name: 'Python Expert',
    description: 'A helpful coding assistant specializing in Python best practices.',
    instructions: 'You are an expert Python developer. You prefer clean, type-hinted code. You explain complex concepts simply. Always use the latest Python 3.12+ features where applicable.',
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Creative Writer',
    description: 'Helps brainstorm stories and improve creative writing flow.',
    instructions: 'You are a creative writing coach. You offer constructive feedback, suggest "show, don\'t tell" improvements, and help brainstorm plot twists. Your tone is encouraging and whimsical.',
    created_at: new Date().toISOString()
  }
];

// Helper to simulate DB delay for local storage
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getGems = async (config: AppConfig): Promise<Gem[]> => {
  // Mode 1: API (Backend via Auth Service)
  if (!config.useLocalStorage) {
    return await getGemsWithAuth(config);
  }

  // Mode 2: LocalStorage
  await delay(300);
  const stored = localStorage.getItem('gemini_gems_data');
  if (!stored) {
    localStorage.setItem('gemini_gems_data', JSON.stringify(INITIAL_GEMS));
    return INITIAL_GEMS;
  }
  return JSON.parse(stored);
};

export const createGem = async (gem: Omit<Gem, 'id' | 'created_at'>, config: AppConfig): Promise<Gem> => {
  // Mode 1: API
  if (!config.useLocalStorage) {
    return await createGemWithAuth(gem, config);
  }

  // Mode 2: Local Storage
  await delay(300);
  const newGem = {
    ...gem,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString()
  };
  
  const stored = JSON.parse(localStorage.getItem('gemini_gems_data') || '[]');
  const updated = [newGem, ...stored];
  localStorage.setItem('gemini_gems_data', JSON.stringify(updated));
  return newGem;
};

export const updateGem = async (gem: Gem, config: AppConfig): Promise<Gem> => {
  // Mode 1: API
  if (!config.useLocalStorage) {
    return await updateGemWithAuth(gem, config);
  }

  // Mode 2: Local Storage
  await delay(300);
  const stored = JSON.parse(localStorage.getItem('gemini_gems_data') || '[]');
  const updated = stored.map((g: Gem) => g.id === gem.id ? gem : g);
  localStorage.setItem('gemini_gems_data', JSON.stringify(updated));
  return gem;
};

export const deleteGem = async (id: string, config: AppConfig): Promise<void> => {
  // Mode 1: API
  if (!config.useLocalStorage) {
    return await deleteGemWithAuth(id, config);
  }

  // Mode 2: Local Storage
  await delay(300);
  const stored = JSON.parse(localStorage.getItem('gemini_gems_data') || '[]');
  const updated = stored.filter((g: Gem) => g.id !== id);
  localStorage.setItem('gemini_gems_data', JSON.stringify(updated));
};
