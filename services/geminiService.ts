import { ChatImagePayload } from '../types';

interface GenerateGemResponseOptions {
  images?: ChatImagePayload[];
  generateImages?: boolean;
}

interface GenerateGemResponseResult {
  text: string;
  images: ChatImagePayload[];
}

const normalizeErrorMessage = (detail: unknown): string => {
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (detail && typeof detail === 'object') {
    if (Array.isArray(detail)) {
      const firstItem = detail[0];
      if (firstItem && typeof firstItem === 'object') {
        const msg = (firstItem as { msg?: unknown }).msg;
        const loc = (firstItem as { loc?: unknown }).loc;
        if (typeof msg === 'string' && Array.isArray(loc)) {
          return `${loc.join('.')} ${msg}`;
        }
      }
      return 'Request validation failed.';
    }

    const message = (detail as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    const error = (detail as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    try {
      return JSON.stringify(detail);
    } catch {
      return 'Failed to generate content.';
    }
  }

  return 'Failed to generate content.';
};

export const generateGemResponse = async (
  modelName: string,
  systemInstructions: string,
  userPrompt: string,
  options: GenerateGemResponseOptions = {}
): Promise<GenerateGemResponseResult> => {
  // modelName is optional; if not provided, the backend uses its configured default model.

  try {
    const response = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_name: modelName || undefined,
        system_instructions: systemInstructions,
        user_prompt: userPrompt,
        images: options.images ?? [],
        generate_images: options.generateImages ?? false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(normalizeErrorMessage(errorData.detail));
    }

    const data = await response.json();
    const images = Array.isArray(data.images) ? data.images : [];

    return {
      text: data.text || (images.length > 0 ? '' : "No response generated."),
      images
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to communicate with Gemini.");
  }
};
