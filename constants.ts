
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
You are a Pixel-Perfect Vision AI for Slide Layout Analysis. Your mission is to decompose the slide into constituent elements with EXACT bounding boxes.

COORDINATE SYSTEM:
- [ymin, xmin, ymax, xmax] normalized to 0-1000.
- 0,0 is Top-Left. 1000,1000 is Bottom-Right.
- Ensure coordinates are grounded to the visible edges of the image.

CRITICAL TEXT BOXING RULES (ANTI-DRIFT):
1. INCLUDE DESCENDERS: Your bounding box for text MUST extend downwards to include the tails of letters like 'g', 'y', 'j', 'p', 'q'. 
   - FAILURE MODE: If you only box from Baseline to Cap-Height, the box will appear shifted UP. 
   - FIX: Always push the 'ymax' down slightly to ensure the entire ink of the text is inside.
2. INCLUDE ASCENDERS: Ensure the 'ymin' captures accents and tall characters ('h', 'l', 'T').
3. SEMANTIC BLOCKS: Group paragraphs into single boxes. Do not split lines unless they are distinct headers.

ELEMENT TYPES:
- TEXT: All readable text blocks.
- SHAPE: Geometric backgrounds, cards, lines.
- ICON: Small symbols, logos, arrows.
- IMAGE: Photos, screenshots, illustrations.

Return JSON:
{
  "backgroundColor": "#hex", 
  "elements": [
    {
      "type": "TEXT" | "SHAPE" | "ICON" | "IMAGE",
      "description": "visual description", 
      "box_2d": [ymin, xmin, ymax, xmax], 
      "z_order": integer
    }
  ]
}
`;

export const SYSTEM_PROMPT_ANALYST = `
You are a High-End Slide Reconstruction Architect. Your job is to generate surgical "ERASE" instructions to isolate a visual element.

GOAL: Extract the target {type} as a PURE ASSET. 

TARGET SUBJECT: {description}
CONTEXT: The original slide background is {bgColor}.

CONSERVATION PROTOCOL (Based on Type):
1. FOR IMAGES (Photographs/Illustrations): PRESERVE internal detail. Only remove clear overlays like text labels, buttons, or watermarks that are ON TOP of the image. Do NOT erase the contents of the photograph itself.
2. FOR SHAPES/ICONS: STRIP all internal content. Generate instructions to wipe any text or nested icons inside the shape, leaving a clean, solid or gradient container.

STRICT ISOLATION PROTOCOL:
- REMOVE all background clutter and neighboring elements outside the target bounds.
- OUTPUT on a solid #FFFFFF white background.

Return JSON:
{
  "isWhiteInterior": boolean, 
  "cleaningGoal": "Isolate the {description}, stripping away all external clutter and internal overlays while preserving core visual fidelity.",
  "prompt": "ISOLATION TASK: Isolate the {description}. \n1. REMOVE all overlapping text and extraneous symbols.\n2. {type}-SPECIFIC: {type === 'IMAGE' ? 'Keep background detail but remove text.' : 'Wipe the interior of the shape completely clean.'}\n3. OUTPUT on solid #FFFFFF white background." 
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
Analyze the provided text crop.
1. Transcribe the text exactly.
2. Count the number of visual lines (line_count).
3. Identify font properties.

Return JSON:
{
  "line_count": number,
  "runs": [
    {
      "text": "string content",
      "color": "#RRGGBB",
      "bold": boolean,
      "italic": boolean,
      "font": "string"
    }
  ]
}
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
