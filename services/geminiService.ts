
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { 
  MODEL_DETECTION, 
  MODEL_TEXT_ANALYSIS, 
  SYSTEM_PROMPT_DETECTION,
  PROMPT_TEXT_EXTRACTION,
  PROMPT_QA_CRITIC,
  SYSTEM_PROMPT_ANALYST,
  getPromptForCleaning
} from '../constants';
import { SlideElement } from '../types';
import { padImageToSquare, unpadGeneratedImage, loadImage, resizeImage } from './imageProcessing';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const cleanJsonString = (str: string): string => {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace('```json', '');
  if (cleaned.startsWith('```')) cleaned = cleaned.replace('```', '');
  if (cleaned.startsWith('```')) cleaned = cleaned.replace('```', '');
  if (cleaned.endsWith('```')) cleaned = cleaned.replace('```', '');
  return cleaned.trim();
};

const base64ToDataPart = (base64: string) => {
  let mimeType = 'image/png';
  let data = base64;
  if (base64.startsWith('data:')) {
    const parts = base64.split(',');
    if (parts.length === 2) {
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) mimeType = mimeMatch[1];
        data = parts[1];
    }
  }
  return { inlineData: { mimeType, data } };
};

export const withTimeout = <T>(promise: Promise<T>, ms: number, msg: string): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(msg)), ms);
        promise.then(res => { clearTimeout(timer); resolve(res); }).catch(err => { clearTimeout(timer); reject(err); });
    });
};

export const withRetry = async <T>(fn: () => Promise<T>, retries: number, stageName: string): Promise<T> => {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      console.warn(`${stageName} Attempt ${i+1} Failed: ${e}`);
      if (i < retries) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  throw lastError;
};

export const detectElements = async (imageBase64: string, modelName: string = MODEL_DETECTION) => {
  // Increased resolution to 1536 for better icon/detail visibility
  const optimizedImage = await resizeImage(imageBase64, 1536);
  const response = await ai.models.generateContent({
    model: modelName,
    config: {
      systemInstruction: SYSTEM_PROMPT_DETECTION,
      responseMimeType: 'application/json',
    },
    contents: { parts: [base64ToDataPart(optimizedImage), { text: "Analyze slide layout for EXHAUSTIVE DECOMPOSITION." }] }
  });

  const result = JSON.parse(cleanJsonString(response.text || '{"elements": []}'));
  const rawElements = result.elements || [];
  const backgroundColor = result.backgroundColor || '#FFFFFF';

  return {
    data: rawElements.map((el: any, i: number) => ({
      id: `el-${Date.now()}-${i}`,
      type: el.type,
      description: el.description,
      box_2d: el.box_2d,
      z_order: el.z_order,
      status: el.type === 'TEXT' ? 'COMPLETED' : 'PENDING',
      textContent: el.text_content,
      textColor: el.text_color,
      isBold: el.is_bold,
      attempts: 0
    })),
    backgroundColor,
    usage: [{ model: modelName, usageMetadata: response.usageMetadata }]
  };
};

export const analyzeTextElement = async (element: SlideElement, crop: string) => {
  const response = await ai.models.generateContent({
    model: MODEL_TEXT_ANALYSIS,
    config: { responseMimeType: 'application/json' },
    contents: { parts: [base64ToDataPart(crop), { text: PROMPT_TEXT_EXTRACTION }] }
  });
  const data = JSON.parse(cleanJsonString(response.text || '{}'));
  return {
    data: { ...element, textContent: data.text, textColor: data.hexColor, isBold: data.isBold, status: 'COMPLETED' as const },
    usage: [{ model: MODEL_TEXT_ANALYSIS, usageMetadata: response.usageMetadata }]
  };
};

/**
 * STAGE 1: ANALYST
 */
export const runAnalystStage = async (
  element: SlideElement, 
  crop: string, 
  model: string, 
  backgroundColor: string = '#FFFFFF'
) => {
  const promptTemplate = SYSTEM_PROMPT_ANALYST
    .replace('{type}', element.type)
    .replace('{description}', element.description || 'object')
    .replace(/{bgColor}/g, backgroundColor);

  const response = await withTimeout<GenerateContentResponse>(
    ai.models.generateContent({
      model,
      config: { responseMimeType: 'application/json' },
      contents: { parts: [base64ToDataPart(crop), { text: promptTemplate }] }
    }),
    60000, "Analyst Stage Timeout"
  );
  
  try {
    const data = JSON.parse(cleanJsonString(response.text || '{}'));
    return { 
      prompt: data.prompt || getPromptForCleaning(element.type, element.description),
      isWhiteInterior: data.isWhiteInterior !== undefined ? !!data.isWhiteInterior : false,
      cleaningGoal: data.cleaningGoal || "Isolate the object perfectly.",
      usage: { model, usageMetadata: response.usageMetadata }
    };
  } catch (e) {
    return {
      prompt: getPromptForCleaning(element.type, element.description),
      isWhiteInterior: false,
      cleaningGoal: "Isolate the object perfectly.",
      usage: { model, usageMetadata: response.usageMetadata }
    };
  }
};

/**
 * STAGE 2: CLEANER
 * Supports refinement via inputOverride.
 */
export const runCleanerStage = async (crop: string, prompt: string, model: string, inputOverride?: string) => {
  const img = await loadImage(crop);
  const squareInput = await padImageToSquare(inputOverride || crop);
  
  const response = await withTimeout<GenerateContentResponse>(
    ai.models.generateContent({
      model,
      config: { imageConfig: { aspectRatio: "1:1" } },
      contents: { parts: [base64ToDataPart(squareInput), { text: `ERASE TASK: ${prompt}\n\nMaintain target object fidelity. Output on pure white #FFFFFF background.` }] }
    }),
    120000, "Cleaner Stage Timeout"
  );
  
  let base64: string | null = null;
  const firstCandidate = response.candidates?.[0];
  if (firstCandidate && firstCandidate.content && firstCandidate.content.parts) {
    for (const part of firstCandidate.content.parts) {
      if (part.inlineData) {
        base64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        break;
      }
    }
  }
  
  if (!base64) throw new Error("Cleaner failed to produce image.");
  
  // Use unpadGeneratedImage to correctly handle scale differences between original crop and generative output
  const restored = await unpadGeneratedImage(base64, img.width, img.height);
  
  return { 
    base64: restored,
    usage: { model, usageMetadata: response.usageMetadata }
  };
};

/**
 * STAGE 3: QA CRITIC
 */
export const runQAStage = async (originalCrop: string, cleanedResult: string, model: string, cleaningGoal: string) => {
  const criticPrompt = PROMPT_QA_CRITIC.replace('{cleaningGoal}', cleaningGoal);
  const response = await withTimeout<GenerateContentResponse>(
    ai.models.generateContent({
      model,
      config: { responseMimeType: 'application/json' },
      contents: { parts: [
        { text: "Original Reference Crop:" }, base64ToDataPart(originalCrop),
        { text: "Cleaned Candidate Result:" }, base64ToDataPart(cleanedResult),
        { text: criticPrompt }
      ]}
    }),
    120000, "QA Stage Timeout"
  );

  const data = JSON.parse(cleanJsonString(response.text || '{}'));
  return {
    qaData: data,
    usage: { model, usageMetadata: response.usageMetadata }
  };
};
