export interface Gem {
  id: string;
  name: string;
  description: string;
  instructions: string;
  created_at?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface AppConfig {
  geminiApiKey: string;
  supabaseUrl: string;
  supabaseKey: string;
  useLocalStorage: boolean; // Fallback if no supabase credentials
}

export type ViewMode = 'manager' | 'chat' | 'settings';