import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Gem, AppConfig } from '../types';

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

let supabase: SupabaseClient | null = null;

export const initSupabase = (url: string, key: string) => {
  if (url && key) {
    try {
      supabase = createClient(url, key);
    } catch (e) {
      console.error("Failed to init supabase", e);
      supabase = null;
    }
  } else {
    supabase = null;
  }
};

export const testSupabaseConnection = async (url: string, key: string): Promise<boolean> => {
  try {
    const client = createClient(url, key);
    // Try to fetch a single row or just count to verify connection
    const { error } = await client.from('gems').select('count', { count: 'exact', head: true });
    return !error;
  } catch (e) {
    console.error("Supabase connection test failed:", e);
    return false;
  }
};

// Helper to simulate DB delay for local storage
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getGems = async (config: AppConfig): Promise<Gem[]> => {
  // Mode 1: Supabase
  if (!config.useLocalStorage && supabase) {
    const { data, error } = await supabase
      .from('gems')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Gem[];
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
  const newGem = {
    ...gem,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString()
  };

  if (!config.useLocalStorage && supabase) {
    // We intentionally ignore the ID we generated and let Supabase gen one usually, 
    // but for simplicity here we pass it or let the DB handle it. 
    // Let's send everything except ID if DB is auto-gen, but here we assume the table accepts inserts.
    const { data, error } = await supabase
      .from('gems')
      .insert([ gem ]) // Let supabase generate ID/Timestamp usually, but if table is basic:
      .select()
      .single();
      
    if (error) throw error;
    return data as Gem;
  }

  // Local Storage
  await delay(300);
  const stored = JSON.parse(localStorage.getItem('gemini_gems_data') || '[]');
  const updated = [newGem, ...stored];
  localStorage.setItem('gemini_gems_data', JSON.stringify(updated));
  return newGem;
};

export const updateGem = async (gem: Gem, config: AppConfig): Promise<Gem> => {
  if (!config.useLocalStorage && supabase) {
    const { data, error } = await supabase
      .from('gems')
      .update({ name: gem.name, description: gem.description, instructions: gem.instructions })
      .eq('id', gem.id)
      .select()
      .single();

    if (error) throw error;
    return data as Gem;
  }

  // Local Storage
  await delay(300);
  const stored = JSON.parse(localStorage.getItem('gemini_gems_data') || '[]');
  const updated = stored.map((g: Gem) => g.id === gem.id ? gem : g);
  localStorage.setItem('gemini_gems_data', JSON.stringify(updated));
  return gem;
};

export const deleteGem = async (id: string, config: AppConfig): Promise<void> => {
  if (!config.useLocalStorage && supabase) {
    const { error } = await supabase
      .from('gems')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return;
  }

  // Local Storage
  await delay(300);
  const stored = JSON.parse(localStorage.getItem('gemini_gems_data') || '[]');
  const updated = stored.filter((g: Gem) => g.id !== id);
  localStorage.setItem('gemini_gems_data', JSON.stringify(updated));
};
