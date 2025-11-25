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
  useLocalStorage: boolean;
  // Removed sensitive keys as they are now managed backend-side
}

export type ViewMode = 'manager' | 'chat' | 'settings';