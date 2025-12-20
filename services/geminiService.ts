import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY || ''; 
const DEFAULT_PROXY_URL = 'https://sweet-leaf-f3f1.supercell-help-2015.workers.dev';

if (!API_KEY) {
  console.warn("Missing Gemini API KEY");
}

/**
 * Creates a configured GoogleGenAI client.
 * It checks for a proxy URL in localStorage (set via Login screen) or falls back to default.
 * This effectively routes Gemini requests through the Cloudflare Worker to bypass blocks.
 */
const getGenAIClient = () => {
  // Get proxy URL from storage or use default
  let proxyUrl = localStorage.getItem('ms_proxy_url') || DEFAULT_PROXY_URL;
  // Remove trailing slashes
  proxyUrl = proxyUrl.replace(/\/+$/, '');

  // Using the worker as a baseUrl. 
  // The SDK will append /v1beta/models/... which the updated Worker now handles.
  return new GoogleGenAI({ 
    apiKey: API_KEY,
    baseUrl: proxyUrl 
  });
};

export const analyzeDataWithGemini = async (contextData: string, userPrompt: string) => {
  try {
    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest', // Changed to flash-latest for better speed/cost in tools
      contents: `
        Context Data (JSON):
        ${contextData}

        User Question:
        ${userPrompt}

        System Instruction:
        You are a business analyst assistant for MoySklad. 
        Analyze the provided JSON data (Products or Orders) and answer the user's question concisely. 
        Format amounts in currency if applicable.
      `,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error analyzing the data (Network/Proxy issue).";
  }
};

// Live API Hook
export const useGeminiLive = () => {
  const [isConnected, setIsConnected] = React.useState(false);
  const [isTalking, setIsTalking] = React.useState(false);
  
  // Refs to manage audio context and session without triggering re-renders
  const sessionRef = React.useRef<any>(null);
  const inputContextRef = React.useRef<AudioContext | null>(null);
  const outputContextRef = React.useRef<AudioContext | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const nextStartTimeRef = React.useRef<number>(0);

  const connect = async (systemInstruction: string) => {
    if (!API_KEY) return;
    
    try {
      const ai = getGenAIClient();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected via Proxy");
            setIsConnected(true);
            
            // Setup Input Stream
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = convertFloat32ToInt16(inputData);
              const base64Data = arrayBufferToBase64(pcmData);
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Data
                  }
                });
              });
            };
            
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsTalking(true);
              const audioBuffer = await decodeAudio(audioData, outputCtx);
              playAudio(audioBuffer, outputCtx, nextStartTimeRef);
            }
            
            if (msg.serverContent?.turnComplete) {
              setIsTalking(false);
            }
          },
          onclose: () => {
            console.log("Gemini Live Closed");
            setIsConnected(false);
            cleanup();
          },
          onerror: (err) => {
            console.error("Gemini Live Error", err);
            setIsConnected(false);
            cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        }
      });
      
      sessionRef.current = sessionPromise;
      
    } catch (error) {
      console.error("Failed to connect to Gemini Live", error);
      cleanup();
    }
  };

  const disconnect = () => {
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session.close());
    }
    cleanup();
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }
    setIsConnected(false);
    setIsTalking(false);
  };

  return { connect, disconnect, isConnected, isTalking };
};

// --- Audio Helpers ---

function convertFloat32ToInt16(float32Array: Float32Array): ArrayBuffer {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    int16Array[i] = Math.max(-1, Math.min(1, float32Array[i])) * 32767;
  }
  return int16Array.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeAudio(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const int16View = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, int16View.length, 24000);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < int16View.length; i++) {
    channelData[i] = int16View[i] / 32768.0;
  }
  
  return Promise.resolve(buffer);
}

function playAudio(buffer: AudioBuffer, ctx: AudioContext, nextStartTimeRef: React.MutableRefObject<number>) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  
  const currentTime = ctx.currentTime;
  if (nextStartTimeRef.current < currentTime) {
    nextStartTimeRef.current = currentTime;
  }
  
  source.start(nextStartTimeRef.current);
  nextStartTimeRef.current += buffer.duration;
}

import React from 'react'; 
