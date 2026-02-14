
export enum ElementType {
  TEXT = 'TEXT',
  SHAPE = 'SHAPE',
  ICON = 'ICON',
  IMAGE = 'IMAGE',
  UNKNOWN = 'UNKNOWN'
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface CleaningHistoryItem {
  attempt: number;
  timestamp: number;
  model: string;
  prompt: string;
  status: 'SUCCESS' | 'QA_FAILED' | 'GENERATION_FAILED';
  qaScore?: number;
  qaFeedback?: string;
  actionTaken: string; 
}

export interface SlideElement {
  id: string;
  type: ElementType;
  description?: string; 
  sourceDetectionData?: any; 
  box_2d: [number, number, number, number]; 
  z_order: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  
  originalCropBase64?: string;
  cleanedImageBase64?: string;
  
  textContent?: string;
  textColor?: string;
  isBold?: boolean;
  fontSize?: number;

  attempts: number;
  qaScore?: number;
  qaFeedback?: string;
  initialPrompt?: string; 
  retryPrompt?: string; 
  nextAction?: 'RETRY_FROM_SCRATCH' | 'REFINE_CURRENT'; 
  
  isWhiteInterior?: boolean; 
  cleaningGoal?: string; 
  
  cleaningHistory?: CleaningHistoryItem[];
  processingDuration?: number; 
}

export interface TokenCounts {
  input: number;
  output: number;
  total: number;
}

export interface TokenStats {
  [modelName: string]: TokenCounts;
}

export interface ModelMapping {
  [ElementType.SHAPE]: string;
  [ElementType.ICON]: string;
  [ElementType.IMAGE]: string;
}

export interface AppState {
  currentStep: 'IDLE' | 'DETECTING' | 'DETECTED' | 'PROCESSING' | 'COMPLETED';
  originalImageBase64: string | null;
  imageDimensions: { width: number; height: number };
  elements: SlideElement[];
  selectedElementId: string | null;
  logs: string[];
  tokenStats: TokenStats;
  detectionModel: string;
  cleaningModel: string; // Global default (if needed)
  modelMapping: ModelMapping; // Specific routing
  qaModel: string;
  parallelCount: number;
  slideBackgroundColor?: string; 
  
  pipelineStartTime?: number; 
  pipelineEndTime?: number;   

  currentAction?: string; 
  currentActionStartTime?: number; 
}

export const PPTX_WIDTH_INCHES = 10;
export const PPTX_HEIGHT_INCHES = 5.625;
