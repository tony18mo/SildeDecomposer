
import React, { useState, useEffect } from 'react';
import { DropZone } from './components/DropZone';
import { ProcessingStatus } from './components/ProcessingStatus';
import { LayerOverlay } from './components/LayerOverlay';
import { InspectorPanel } from './components/InspectorPanel';
import { TerminalPanel } from './components/TerminalPanel';
import { AppState, SlideElement, ElementType, TokenStats, CleaningHistoryItem, ModelMapping } from './types';
import { fileToBase64, loadImage, cropImage, removeWhiteBackground } from './services/imageProcessing';
import { detectElements, analyzeTextElement, runAnalystStage, runCleanerStage, runQAStage, withRetry } from './services/geminiService';
import { generatePresentation } from './services/pptxService';
import { Download, Layers, Shield } from 'lucide-react';
import { MODEL_IMAGE_CLEANING_FAST, MODEL_IMAGE_CLEANING_PRO, MODEL_QA, MODEL_DETECTION } from './constants';

const MAX_TOTAL_ATTEMPTS = 4;
const MAX_STAGE_RETRIES = 2; 

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentStep: 'IDLE',
    originalImageBase64: null,
    imageDimensions: { width: 0, height: 0 },
    elements: [],
    selectedElementId: null,
    logs: [],
    tokenStats: {},
    detectionModel: MODEL_DETECTION,
    cleaningModel: MODEL_IMAGE_CLEANING_FAST,
    modelMapping: {
      [ElementType.SHAPE]: MODEL_IMAGE_CLEANING_PRO,
      [ElementType.ICON]: MODEL_IMAGE_CLEANING_FAST,
      [ElementType.IMAGE]: MODEL_IMAGE_CLEANING_FAST,
    },
    qaModel: MODEL_QA,
    parallelCount: 3
  });

  const [hasVeoKey, setHasVeoKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
        if (window.aistudio?.hasSelectedApiKey) {
            const has = await window.aistudio.hasSelectedApiKey();
            setHasVeoKey(has);
        }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
        await window.aistudio.openSelectKey();
        setHasVeoKey(true);
    }
  };

  const addLog = (msg: string) => setState(prev => ({ ...prev, logs: [...prev.logs, msg] }));
  const setAction = (action: string | undefined) => setState(prev => ({ ...prev, currentAction: action, currentActionStartTime: action ? Date.now() : undefined }));

  const updateTokenStats = (usage: { model: string, usageMetadata: any } | { model: string, usageMetadata: any }[] | undefined) => {
    if (!usage) return;
    const items = Array.isArray(usage) ? usage : [usage];
    setState(prev => {
      const newStats = { ...prev.tokenStats };
      items.forEach(item => {
        if (!item.usageMetadata) return;
        const current = newStats[item.model] || { input: 0, output: 0, total: 0 };
        newStats[item.model] = {
          input: current.input + (item.usageMetadata.promptTokenCount || 0),
          output: current.output + (item.usageMetadata.candidatesTokenCount || 0),
          total: current.total + (item.usageMetadata.totalTokenCount || 0)
        };
      });
      return { ...prev, tokenStats: newStats };
    });
  };

  /**
   * Functional state updates to prevent race conditions during parallel processing.
   */
  const updateElement = (id: string, updates: Partial<SlideElement> | ((prev: SlideElement) => Partial<SlideElement>)) => {
    setState(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.id !== id) return el;
        const up = typeof updates === 'function' ? updates(el) : updates;
        return { ...el, ...up };
      })
    }));
  };

  const handleUpdateElementBox = (id: string, box: [number, number, number, number]) => {
    updateElement(id, { 
      box_2d: box,
      status: 'PENDING',
      originalCropBase64: undefined,
      cleanedImageBase64: undefined,
      attempts: 0,
      cleaningHistory: []
    });
  };

  const handleUpdatePrompt = (id: string, prompt: string) => {
    updateElement(id, { retryPrompt: prompt });
  };

  const handleFileSelect = async (file: File) => {
    addLog(`Loading ${file.name}...`);
    const base64 = await fileToBase64(file);
    const img = await loadImage(base64);
    setState(prev => ({ ...prev, currentStep: 'DETECTING', originalImageBase64: base64, imageDimensions: { width: img.width, height: img.height }, elements: [], logs: [`Image: ${img.width}x${img.height}`] }));
    
    setAction(`Detecting slide layers...`);
    try {
        const res = await detectElements(base64, state.detectionModel);
        updateTokenStats(res.usage);
        setState(prev => ({ 
          ...prev, 
          elements: res.data, 
          slideBackgroundColor: res.backgroundColor,
          currentStep: 'DETECTED' 
        }));
        addLog(`Found ${res.data.length} elements.`);
    } catch (err) {
        addLog(`Detection Failed: ${err}`);
        setState(prev => ({ ...prev, currentStep: 'IDLE' }));
    }
    setAction(undefined);
  };

  /**
   * Enhanced multi-attempt self-correction loop.
   * Auto-retries up to 4 times based on QA agent feedback.
   */
  const runVisualCleaningLoop = async (el: SlideElement, crop: string, manualPromptOverride?: string) => {
    const itemLabel = `[${el.id.split('-').pop()}]`;
    let success = false;
    
    // Determine context: initial run or user-triggered retry
    let activePrompt = manualPromptOverride || el.retryPrompt || el.initialPrompt || "";
    let isWhiteInterior = el.isWhiteInterior || false;
    let cleaningGoal = el.cleaningGoal || "";
    let currentAttempt = manualPromptOverride ? 0 : (el.attempts || 0);

    const modelToUse = state.modelMapping[el.type as keyof ModelMapping] || MODEL_IMAGE_CLEANING_FAST;

    if (modelToUse === MODEL_IMAGE_CLEANING_PRO && !hasVeoKey) {
        addLog(`${itemLabel} Error: Pro model needs API Key.`);
        updateElement(el.id, { status: 'FAILED' });
        return;
    }

    try {
      // Stage 1: Analyst Planning (only if no prompt exists)
      if (!activePrompt) {
        addLog(`${itemLabel} Analyst planning...`);
        const analystRes = await withRetry(
            () => runAnalystStage(el, crop, 'gemini-3-flash-preview', state.slideBackgroundColor),
            MAX_STAGE_RETRIES, 
            `${itemLabel} Analyst`
        );
        updateTokenStats(analystRes.usage);
        activePrompt = analystRes.prompt;
        isWhiteInterior = analystRes.isWhiteInterior;
        cleaningGoal = analystRes.cleaningGoal;
        updateElement(el.id, { initialPrompt: activePrompt, isWhiteInterior, cleaningGoal });
      }

      // Main Self-Correction Loop
      while (currentAttempt < MAX_TOTAL_ATTEMPTS && !success) {
        currentAttempt++;
        updateElement(el.id, { status: 'PROCESSING', attempts: currentAttempt });
        addLog(`${itemLabel} Attempt ${currentAttempt}/${MAX_TOTAL_ATTEMPTS} starting...`);

        // Stage 2: Cleaner
        const stage2Res = await withRetry(
            () => runCleanerStage(crop, activePrompt, modelToUse),
            MAX_STAGE_RETRIES, 
            `${itemLabel} Cleaning`
        );
        updateTokenStats(stage2Res.usage);
        const cleanedRaw = stage2Res.base64;
        
        // Background removal
        const transparencyMode = isWhiteInterior ? 'flood' : 'all';
        const transparent = await removeWhiteBackground(cleanedRaw, transparencyMode);
        updateElement(el.id, { cleanedImageBase64: transparent });

        // Stage 3: QA Critic
        addLog(`${itemLabel} QA Agent evaluating...`);
        const stage3Res = await withRetry(
            () => runQAStage(crop, cleanedRaw, state.qaModel, cleaningGoal),
            MAX_STAGE_RETRIES, 
            `${itemLabel} QA`
        );
        updateTokenStats(stage3Res.usage);
        const qa = stage3Res.qaData;

        // Update history (functional)
        updateElement(el.id, prev => ({
          cleaningHistory: [
            ...(prev.cleaningHistory || []),
            {
              attempt: currentAttempt,
              timestamp: Date.now(),
              model: modelToUse,
              prompt: activePrompt,
              status: qa.verdict === 'PASS' ? 'SUCCESS' : 'QA_FAILED',
              qaScore: qa.score,
              qaFeedback: qa.reason,
              actionTaken: qa.verdict === 'PASS' ? 'Quality passed.' : `Failed. Improved prompt generated.`
            }
          ],
          qaScore: qa.score,
          qaFeedback: qa.reason,
          retryPrompt: qa.improvedPrompt || activePrompt // Feed improved prompt to next loop
        }));

        if (qa.verdict === 'PASS' && qa.score >= 85) { // Threshold updated to 85 to match new strict rubric
          success = true;
          updateElement(el.id, { status: 'COMPLETED' });
          addLog(`${itemLabel} ✓ SUCCESS on attempt ${currentAttempt} (Score: ${qa.score})`);
        } else {
          addLog(`${itemLabel} ✗ Attempt ${currentAttempt} failed QA (${qa.score}).`);
          activePrompt = qa.improvedPrompt || activePrompt;
          
          if (currentAttempt < MAX_TOTAL_ATTEMPTS) {
            addLog(`${itemLabel} Auto-retrying with self-correction...`);
            await new Promise(r => setTimeout(r, 1000)); // Cool-down
          }
        }
      }

      if (!success) {
        updateElement(el.id, { status: 'FAILED' });
        addLog(`${itemLabel} Stop: Max auto-attempts (${MAX_TOTAL_ATTEMPTS}) reached. Manual fix required.`);
      }

    } catch (err) {
      addLog(`${itemLabel} Critical Error: ${err instanceof Error ? err.message : 'Unknown'}`);
      updateElement(el.id, { status: 'FAILED' });
    }
  };

  const handleStartGlobalCleaning = async () => {
    setState(prev => ({ ...prev, currentStep: 'PROCESSING', pipelineStartTime: Date.now() }));
    const sourceImg = await loadImage(state.originalImageBase64!);
    const pending = state.elements.filter(e => e.status === 'PENDING');

    addLog(`Batch extraction starting...`);

    const queue = [...pending];
    const worker = async () => {
      while (queue.length > 0) {
        const el = queue.shift();
        if (!el) break;
        const idSuffix = el.id.split('-').pop() ?? '';
        setAction(`Task: ${el.type} #${idSuffix}`);
        const crop = cropImage(sourceImg, el.box_2d);
        updateElement(el.id, { originalCropBase64: crop });
        if (el.type === ElementType.TEXT) {
          try {
            const res = await analyzeTextElement(el, crop);
            updateTokenStats(res.usage);
            updateElement(el.id, res.data);
          } catch (err) { addLog(`[${idSuffix}] Text failed.`); }
        } else {
          await runVisualCleaningLoop(el, crop);
        }
      }
    };

    const workers = Array.from({ length: Math.min(state.parallelCount, pending.length) }).map(() => worker());
    await Promise.all(workers);

    setState(prev => ({ ...prev, currentStep: 'COMPLETED', pipelineEndTime: Date.now() }));
    setAction(undefined);
    addLog("Finished.");
  };

  const handleSelectElement = async (id: string) => {
    setState(prev => ({ ...prev, selectedElementId: id }));
    const el = state.elements.find(e => e.id === id);
    if (el && !el.originalCropBase64) {
        const sourceImg = await loadImage(state.originalImageBase64!);
        updateElement(id, { originalCropBase64: cropImage(sourceImg, el.box_2d) });
    }
  };

  return (
    <div className="flex h-screen bg-black text-gray-100 font-sans overflow-hidden">
      {state.currentStep !== 'IDLE' && (
        <ProcessingStatus 
            elements={state.elements} selectedId={state.selectedElementId}
            onSelectElement={handleSelectElement} onStartAll={handleStartGlobalCleaning}
            canStart={state.currentStep === 'DETECTED'} tokenStats={state.tokenStats}
            detectionModel={state.detectionModel}
            onDetectionModelChange={(m) => setState(p => ({...p, detectionModel: m}))}
            modelMapping={state.modelMapping}
            onMappingChange={(type, model) => setState(p => ({...p, modelMapping: {...p.modelMapping, [type]: model}}))}
            qaModel={state.qaModel} onQaModelChange={(m) => setState(p => ({...p, qaModel: m}))}
            parallelCount={state.parallelCount} onParallelCountChange={(c) => setState(p => ({...p, parallelCount: c}))}
            currentAction={state.currentAction} currentActionStartTime={state.currentActionStartTime}
            onRunSingleElement={(id) => runVisualCleaningLoop(state.elements.find(e => e.id === id)!, state.elements.find(e => e.id === id)!.originalCropBase64!)}
        />
      )}
      <div className="flex-1 flex flex-col relative h-full">
        <header className="h-14 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-6 z-20">
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                    <Layers className="text-blue-500" size={20}/>
                    <h1 className="text-lg font-bold tracking-tight">SlideDecomposer <span className="text-blue-500">AI</span></h1>
                </div>
                {!hasVeoKey && (
                    <button 
                        onClick={handleSelectKey}
                        className="flex items-center gap-1.5 px-3 py-1 bg-amber-900/20 border border-amber-500/30 text-amber-400 text-xs font-bold rounded hover:bg-amber-900/40 transition-all"
                    >
                        <Shield size={14} /> Unlock Pro Shapes
                    </button>
                )}
            </div>
            {state.currentStep === 'COMPLETED' && (
                <button onClick={() => generatePresentation(state.elements, state.originalImageBase64, state.imageDimensions.width, state.imageDimensions.height)} className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded text-xs font-bold transition-all shadow-lg"><Download size={14}/><span>Download PPTX</span></button>
            )}
        </header>
        <main className="flex-1 flex relative overflow-hidden bg-gray-900">
            {state.currentStep === 'IDLE' ? <div className="m-auto w-full max-w-lg px-6"><DropZone onFileSelect={handleFileSelect} /></div> : (
                <>
                    <LayerOverlay 
                        imageSrc={state.originalImageBase64!} 
                        elements={state.elements} 
                        selectedId={state.selectedElementId} 
                        onSelect={handleSelectElement}
                        onUpdateBox={handleUpdateElementBox}
                    />
                    <TerminalPanel logs={state.logs} onClear={() => setState(p => ({...p, logs: []}))}/>
                </>
            )}
        </main>
      </div>
      {state.selectedElementId && (
        <InspectorPanel 
            element={state.elements.find(e => e.id === state.selectedElementId)!} 
            onClose={() => setState(p => ({...p, selectedElementId: null}))} 
            onRunAgent={(id, manualPrompt) => runVisualCleaningLoop(state.elements.find(e => e.id === id)!, state.elements.find(e => e.id === id)!.originalCropBase64!, manualPrompt)}
            onUpdatePrompt={handleUpdatePrompt}
        />
      )}
    </div>
  );
};

export default App;
