export const generateGemResponse = async (
  apiKey: string,
  modelName: string,
  systemInstructions: string,
  userPrompt: string
): Promise<string> => {
  // The apiKey param is ignored as the backend handles it securely.
  // modelName is optional; if not provided, the backend uses its configured default (GEMINI_MODEL).

  try {
    const response = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_name: modelName || undefined,
        system_instructions: systemInstructions,
        user_prompt: userPrompt
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || "Failed to generate content.");
    }

    const data = await response.json();
    return data.text || "No response generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to communicate with Gemini.");
  }
};