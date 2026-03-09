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
  images?: ChatImage[];
}

export interface AppConfig {
  useLocalStorage: boolean;
  // Removed sensitive keys as they are now managed backend-side
}

export interface ChatImage {
  dataUrl: string;
  mimeType: string;
  name?: string;
}

export interface ChatImagePayload {
  data: string;
  mime_type: string;
  name?: string;
}

export type ViewMode = 'manager' | 'chat' | 'settings';

export interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

export interface AuthResponse {
  user: User | null;
  error?: string;
}
