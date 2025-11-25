import { GoogleGenAI } from "@google/genai";

export const generateGemResponse = async (
  apiKey: string,
  modelName: string,
  systemInstructions: string,
  userPrompt: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please check settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // As per instructions: Use gemini-3-pro-preview for complex tasks (Gems usually are)
  // Or gemini-2.5-flash for speed. The prompt requested "Gemini Pro".
  const effectiveModel = modelName || 'gemini-3-pro-preview';

  try {
    const response = await ai.models.generateContent({
      model: effectiveModel,
      contents: userPrompt,
      config: {
        systemInstruction: systemInstructions,
      }
    });

    return response.text || "No response generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to communicate with Gemini.");
  }
};