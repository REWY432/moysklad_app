/**
 * AI Service has been disabled.
 * This file is kept as a placeholder to prevent import errors if any remain,
 * but no logic is exported.
 */

export const analyzeDataWithGemini = async (contextData: string, userPrompt: string) => {
  return "AI functionality is disabled.";
};

export const useGeminiLive = () => {
  return { 
    connect: async () => {}, 
    disconnect: () => {}, 
    isConnected: false, 
    isTalking: false 
  };
};
