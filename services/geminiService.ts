import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Ensure we have a key (mock check, real key comes from env or selection)
const getApiKey = () => process.env.API_KEY || '';

// Basic AI for standard tasks
const getAI = () => new GoogleGenAI({ apiKey: getApiKey() });

// --- Chatbot ---
export const sendChatMessage = async (history: { role: 'user' | 'model'; parts: { text: string }[] }[], newMessage: string): Promise<string> => {
  try {
    const ai = getAI();
    // Using gemini-3-pro-preview for chat as requested
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      history: history,
      config: {
        systemInstruction: "Eres un asistente útil para un sistema TPV (Punto de Venta) de un restaurante. Ayudas con recetas, consejos de gestión de inventario, programación del personal y atención al cliente. Responde siempre en español.",
      }
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text || "No pude generar una respuesta.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "Lo siento, encontré un error al procesar tu solicitud.";
  }
};

// --- Image Generation ---
export const generateRestaurantImage = async (prompt: string, size: '1K' | '2K' | '4K'): Promise<string | null> => {
  try {
    // Check/Request Key for High Quality Image Gen
    // @ts-ignore
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            // @ts-ignore
            await window.aistudio.openSelectKey();
        }
    }

    // Always create a NEW instance after potential key selection to grab the latest key from env
    const ai = getAI();
    
    // Using gemini-3-pro-image-preview for high quality images
    const model = 'gemini-3-pro-image-preview';

    const response = await ai.models.generateContent({
        model,
        contents: {
            parts: [{ text: prompt }]
        },
        config: {
            imageConfig: {
                imageSize: size,
                aspectRatio: "16:9" // Good for marketing materials
            }
        }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    return null;
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};

// --- Image Analysis ---
export const analyzeUploadedImage = async (base64Data: string, mimeType: string, prompt: string): Promise<string> => {
    try {
        const ai = getAI();
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    },
                    { text: prompt + " (Responde en español)" }
                ]
            }
        });
        return response.text || "No se pudo generar el análisis.";
    } catch (error) {
        console.error("Image Analysis Error:", error);
        return "Error al analizar la imagen.";
    }
};

// --- Video Understanding ---
export const analyzeUploadedVideo = async (base64Data: string, mimeType: string, prompt: string): Promise<string> => {
    try {
        const ai = getAI();
        // Sending small video clips as inline data
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    },
                    { text: prompt + " (Responde en español)" }
                ]
            }
        });
        return response.text || "No hay análisis de video disponible.";
    } catch (error) {
        console.error("Video Analysis Error:", error);
        return "Error al analizar el video. Nota: Los videos grandes pueden exceder el límite en línea.";
    }
};