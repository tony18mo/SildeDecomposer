
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
import { SlideElement, TextRun } from '../types';
import { padImageToSquare, unpadGeneratedImage, loadImage, resizeImage } from './imageProcessing';

// Store API key in a variable (set by App.tsx)
let apiKey: string = '';

export const setApiKey = (key: string) => {
  apiKey = key;
};

export const getApiKey = () => apiKey;

const getAiClient = () => {
  if (!apiKey) {
    throw new Error("API key not set. Please enter your API key.");
  }
  return new GoogleGenAI({ apiKey });
};

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
      return await fn()
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
  const ai = getAiClient();
  const imgRef = await loadImage(imageBase64);
  // High-Res Detection: Use 2048px to ensure text descenders are clearly visible to the model.
  const optimizedImage = await resizeImage(imageBase64, 2048);
  
  const promptText = `TASK: DECOMPOSE THIS SLIDE.
IMAGE DATA: ${imgRef.naturalWidth}x${imgRef.naturalHeight} pixels.
COORDINATE GROUNDING: 
- [0,0] is the top-left pixel.
- [1000,1000] is the bottom-right pixel.
- CRITICAL: BOUNDING BOXES MUST INCLUDE DESCENDERS (g, y, p, q, j).
- If text box looks too "high", you missed the descenders. Extend ymax down.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview', 
    config: {
      systemInstruction: SYSTEM_PROMPT_DETECTION,
      responseMimeType: 'application/json',
    },
    contents: { parts: [base64ToDataPart(optimizedImage), { text: promptText }] }
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
      status: 'PENDING', 
      attempts: 0
    })),
    backgroundColor,
    usage: [{ model: 'gemini-3-pro-preview', usageMetadata: response.usageMetadata }]
  };
};

export const analyzeTextElement = async (
  element: SlideElement, 
  crop: string, 
  slideHeightPx: number,
  paddingPx: number = 0
) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: MODEL_TEXT_ANALYSIS,
    config: { responseMimeType: 'application/json' },
    contents: { parts: [base64ToDataPart(crop), { text: PROMPT_TEXT_EXTRACTION }] }
  });
  const data = JSON.parse(cleanJsonString(response.text || '{}'));
  
  // GEOMETRIC FONT SIZE CALCULATION
  // We trust the Pro model's bounding box height more than the Flash model's visual estimation.
  // Standard PPT Slide Height = 5.625 inches * 72 pts/inch = 405 pts.
  const PPT_HEIGHT_PTS = 405; 
  
  // Calculate the height of the bounding box in PPT points
  const boxHeightNormalized = Math.abs(element.box_2d[2] - element.box_2d[0]) / 1000;
  const boxHeightPts = boxHeightNormalized * PPT_HEIGHT_PTS;
  
  const lineCount = Math.max(1, data.line_count || 1);
  
  // Calculation Logic:
  // If 1 line: The box typically hugs the content. Font size is ~90% of box height (allowing for slight padding).
  // If >1 line: The box includes line spacing (leading). Standard leading is ~1.15-1.2x font size.
  let calculatedSize = 12;
  
  if (lineCount === 1) {
    calculatedSize = boxHeightPts * 0.90;
  } else {
    calculatedSize = boxHeightPts / (lineCount * 1.15);
  }
  
  // Round to nearest 0.5 to reduce noise (e.g., 13.2 -> 13, 13.6 -> 13.5)
  calculatedSize = Math.round(calculatedSize * 2) / 2;
  calculatedSize = Math.max(8, calculatedSize); // Clamp min size

  const textRuns: TextRun[] = (data.runs || []).map((run: any) => ({
    text: run.text,
    color: run.color || "#000000",
    size: calculatedSize, // Apply geometric size
    bold: !!run.bold,
    italic: !!run.italic,
    font: run.font || "Arial"
  }));

  if (textRuns.length === 0) {
      textRuns.push({
          text: "Extracted Text",
          color: "#000000",
          size: calculatedSize,
          bold: false,
          italic: false,
          font: "Arial"
      });
  }

  return {
    data: { 
      ...element, 
      textRuns,
      status: 'COMPLETED' as const 
    },
    usage: [{ model: MODEL_TEXT_ANALYSIS, usageMetadata: response.usageMetadata }]
  };
};

export const runAnalystStage = async (
  element: SlideElement, 
  crop: string, 
  model: string, 
  backgroundColor: string = '#FFFFFF'
) => {
  const ai = getAiClient();
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

export const runCleanerStage = async (crop: string, prompt: string, model: string, inputOverride?: string) => {
  const ai = getAiClient();
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
  const restored = await unpadGeneratedImage(base64, img.width, img.height);
  
  return { 
    base64: restored,
    usage: { model, usageMetadata: response.usageMetadata }
  };
};

export const runQAStage = async (originalCrop: string, cleanedResult: string, model: string, cleaningGoal: string) => {
  const ai = getAiClient();
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
