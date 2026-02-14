
import { ElementType } from './types';

export const MODEL_DETECTION = 'gemini-3-pro-preview';
export const MODEL_TEXT_ANALYSIS = 'gemini-3-flash-preview';
export const MODEL_IMAGE_CLEANING_FAST = 'gemini-2.5-flash-image';
export const MODEL_IMAGE_CLEANING_PRO = 'gemini-3-pro-image-preview';
export const MODEL_QA = 'gemini-3-pro-preview';

export const DETECTION_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (High Reasoning - Recommended)' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Fast)' }
];

export const CLEANING_MODELS = [
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash (Fast)' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro (High Quality)' }
];

export const QA_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Reasoning)' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Fast)' }
];

export const SYSTEM_PROMPT_DETECTION = `
You are an expert Vision AI specializing in UI and Slide Decomposition. Your goal is to identify EVERY SINGLE visual element on the provided slide with microscopic precision.

CRITICAL DETECTION RULES:
1. DETECT SMALL ICONS: Scan carefully for small icons, bullets, tiny graphical marks, and decorative elements.
2. INDIVIDUAL COMPONENTS: Do not group disparate items.
3. LOGO INTEGRITY: Detect logos as single units.
4. TYPE CLASSIFICATION:
   - TEXT: Any readable character-based content.
   - SHAPE: Geometric forms (boxes, circles, lines, blobs).
   - ICON: Graphic symbols or logos.
   - IMAGE: Photographic or complex multi-color illustrations.

Return a JSON object:
{
  "backgroundColor": "#hex", 
  "elements": [
    {
      "type": "TEXT" | "SHAPE" | "ICON" | "IMAGE",
      "description": "highly specific visual detail", 
      "box_2d": [ymin, xmin, ymax, xmax], 
      "z_order": integer,
      "text_content": "string (if TEXT)",
      "text_color": "#hex",
      "is_bold": boolean
    }
  ]
}
`;

export const SYSTEM_PROMPT_ANALYST = `
You are a High-End Slide Reconstruction Architect. Your job is to generate surgical "ERASE" instructions to isolate a visual element.

GOAL: Extract the target {type} as a PURE ASSET. 

TARGET SUBJECT: {description}
CONTEXT: The original slide background is {bgColor}.

STRICT ISOLATION PROTOCOL:
1. PURE SUBJECT EXTRACTION: Only the {description} itself should remain. 
2. COMPLETE DESTRUCTION OF OVERLAYS: You MUST instruct the removal of all text, numbers, sub-icons, bullet points, or shadows that are sitting ON TOP of the {description}.
3. INTERNAL CLEANING: If the target is a container (like a box or circle), the final result must be an EMPTY version of that container. The fill and borders must match the original perfectly, but any content inside it must be erased.
4. EXTERNAL CLEANING: Remove all background clutter, neighboring text, and extraneous marks.
5. NO HALLUCINATION: Do not add details that weren't in the original base shape.

Return JSON:
{
  "isWhiteInterior": boolean, // Set to TRUE only if the object's BASE color is white.
  "cleaningGoal": "Isolate the {description}, stripping away all internal and overlapping text/clutter while preserving base visual fidelity.",
  "prompt": "ISOLATION TASK: Isolate the {description}. \n1. REMOVE all text, words, characters, and overlaying symbols.\n2. WIPE the interior of the {type} completely clean of content.\n3. PRESERVE the exact colors, gradients, and border styles of the original {description}.\n4. OUTPUT the result on a solid #FFFFFF white background. No other elements or noise allowed." 
}
`;

export const getPromptForCleaning = (type: ElementType, description?: string) => {
  const targetDesc = description ? `the ${description}` : "the main subject";
  return `ERASE TASK: Isolate ${targetDesc}. 
1. COMPLETELY WIPE all internal text, labels, and nested icons.
2. Maintain the base ${type} colors, gradients, and borders.
3. Output on solid white #FFFFFF.`;
};

export const PROMPT_TEXT_EXTRACTION = `
Return JSON: {"text": "string", "hexColor": "#RRGGBB", "isBold": boolean}
`;

export const PROMPT_QA_CRITIC = `
You are a Strict Quality Assurance Validator.
GOAL: {cleaningGoal}

COMPARISON PROTOCOL:
Compare the "Original Reference Crop" with the "Cleaned Candidate Result".

VALIDATION CHECKLIST:
1. SUBJECT FIDELITY: Does the cleaned object look EXACTLY like the original base subject (shape, color, gradient) minus the overlays?
2. CLUTTER REMOVAL: Is the object 100% free of text, fragments, or overlapping sub-icons? Even tiny dots or letter-remnants are a failure.
3. ISOLATION: Is the background PURE #FFFFFF white? Are there any fragments of the surrounding slide remaining?
4. INTEGRITY: Did the cleaning process accidentally delete parts of the target object itself?

SCORING RUBRIC (Score 0-100):
- 95-100: PERFECT. Zero text remnants. Object is identical to original subject. Background is pure white.
- 85-94: EXCELLENT. Minor almost invisible noise, but text is fully gone and subject is clear.
- 70-84: ACCEPTABLE. Subject is usable but has slight artifacts.
- <70: FAILURE. Text is still readable, fragments of words remain, or the subject's shape is broken.

Return JSON:
{
  "score": number, 
  "verdict": "PASS" (if score >= 85) | "RETRY",
  "reason": "Detailed diagnostic of what remains or what was damaged.",
  "nextAction": "RETRY_FROM_SCRATCH" | "REFINE_CURRENT",
  "improvedPrompt": "A specific, revised set of instructions to fix the failure. If text remains, specify exactly where and what to scrub."
}
`;
