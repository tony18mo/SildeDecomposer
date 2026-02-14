
import { SlideElement, ElementType } from '../types';
import { X, Play, RefreshCw, CheckCircle2, AlertTriangle, Search, Info, ShieldCheck, Zap, Palette, Timer, Bug, ChevronDown, ChevronRight, FileJson, MousePointer2, Save, RotateCcw } from 'lucide-react';
import React, { useState, useEffect } from 'react';

interface InspectorPanelProps {
  element: SlideElement | null;
  onClose: () => void;
  onRunAgent: (id: string, manualPrompt?: string) => void;
  onUpdatePrompt?: (id: string, prompt: string) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ element, onClose, onRunAgent, onUpdatePrompt }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [expandedAttempt, setExpandedAttempt] = useState<number | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);

  useEffect(() => {
    if (element) {
      setEditedPrompt(element.retryPrompt || element.initialPrompt || '');
      setIsEditingPrompt(false);
    }
  }, [element?.id]);

  if (!element) return null;

  const isText = element.type === ElementType.TEXT;
  const isProcessing = element.status === 'PROCESSING' || element.status === 'RETRYING';
  const isCompleted = element.status === 'COMPLETED';
  const canRun = !isText && !isProcessing;

  const history = element.cleaningHistory || [];
  const hasHistory = history.length > 0;
  
  const qaScore = element.qaScore || 0;
  const qaPassed = qaScore >= 85; 
  const qaColorClass = qaPassed ? 'text-green-400' : 'text-orange-400';
  const qaBgClass = qaPassed ? 'bg-green-950/30 border-green-900/50' : 'bg-orange-950/30 border-orange-900/50';

  const isUserModified = element.initialPrompt && editedPrompt !== element.initialPrompt;

  const handleRun = () => {
    // If user modified, we explicitly pass the prompt to runVisualCleaningLoop
    onRunAgent(element.id, isUserModified ? editedPrompt : undefined);
  };

  const handleSavePrompt = () => {
    if (onUpdatePrompt) {
      onUpdatePrompt(element.id, editedPrompt);
    }
    setIsEditingPrompt(false);
  };

  const handleResetPrompt = () => {
    if (element.initialPrompt) {
        setEditedPrompt(element.initialPrompt);
        if (onUpdatePrompt) onUpdatePrompt(element.id, element.initialPrompt);
    }
  };

  return (
    <div className="w-80 h-full bg-gray-900 border-l border-gray-800 flex flex-col shadow-2xl z-20">
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800 bg-gray-950 flex-shrink-0">
        <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Inspector</h2>
            <p className="text-xs text-gray-500 font-mono">{element.id.split('-').pop()}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400">TYPE</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    isText ? 'bg-blue-900 text-blue-200' : 'bg-purple-900 text-purple-200'
                }`}>
                    {element.type}
                </span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400">STATUS</span>
                <span className={`text-xs font-bold flex items-center gap-1 ${
                    isCompleted ? 'text-green-400' : isProcessing ? 'text-blue-400' : 'text-gray-400'
                }`}>
                    {isCompleted && <CheckCircle2 size={12}/>}
                    {isProcessing && <RefreshCw size={12} className="animate-spin"/>}
                    {element.status}
                </span>
            </div>

            <div className="pt-2 border-t border-gray-700/50 flex items-center gap-2 text-[10px] text-amber-400/80 font-medium italic">
                <MousePointer2 size={10} />
                Drag box on slide to adjust crop
            </div>
            
            {!isText && element.qaScore !== undefined && (
                <div className="mt-3 pt-2 border-t border-gray-700/50">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 uppercase tracking-wider">
                            <ShieldCheck size={10} />
                            QA Analysis
                        </span>
                        <span className={`text-xs font-black ${qaColorClass}`}>
                           {qaScore}/100
                        </span>
                    </div>
                    {element.qaFeedback && (
                         <div className={`text-[11px] p-2.5 rounded border ${qaBgClass} text-gray-200 leading-relaxed whitespace-pre-wrap`}>
                            {element.qaFeedback}
                         </div>
                    )}
                </div>
            )}
        </div>

        {!isText && (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Zap size={12} fill="currentColor" />
                            Agent Prompt
                        </h3>
                        {isUserModified && (
                             <span className="text-[9px] bg-amber-900/30 text-amber-400 border border-amber-900/50 px-1.5 rounded font-bold uppercase">Manual</span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {isUserModified && (
                            <button 
                                onClick={handleResetPrompt}
                                className="text-[10px] text-gray-500 hover:text-white transition-colors flex items-center gap-1"
                                title="Reset to AI default"
                            >
                                <RotateCcw size={10}/>
                            </button>
                        )}
                        {!isEditingPrompt ? (
                            <button 
                                onClick={() => setIsEditingPrompt(true)}
                                className="text-[10px] text-blue-500 hover:underline font-bold"
                            >
                                EDIT
                            </button>
                        ) : (
                            <button 
                                onClick={handleSavePrompt}
                                className="text-[10px] text-green-500 hover:underline font-bold flex items-center gap-1"
                            >
                                <Save size={10}/> SAVE
                            </button>
                        )}
                    </div>
                </div>
                {isEditingPrompt ? (
                    <textarea 
                        value={editedPrompt}
                        onChange={(e) => setEditedPrompt(e.target.value)}
                        className="w-full bg-black border border-blue-500/50 rounded p-2 text-[11px] text-blue-100 font-mono h-32 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
                        placeholder="Enter custom ERASE instructions..."
                    />
                ) : (
                    <div 
                        className={`bg-blue-950/10 border p-3 rounded text-[11px] font-medium leading-relaxed italic group cursor-pointer transition-colors ${
                            isUserModified ? 'border-amber-900/40 text-amber-100/70' : 'border-blue-900/40 text-blue-100/70'
                        }`} 
                        onClick={() => setIsEditingPrompt(true)}
                    >
                        {editedPrompt || "No instructions generated yet."}
                    </div>
                )}
            </div>
        )}

        <div className="grid grid-cols-1 gap-4">
            <div>
                <h3 className="text-[10px] font-bold text-gray-500 mb-2 uppercase flex items-center gap-1">
                    <Search size={10}/> Source Crop
                </h3>
                <div className="bg-checkerboard border border-gray-700 rounded-lg p-2 flex items-center justify-center min-h-[140px] shadow-inner overflow-hidden">
                    {element.originalCropBase64 ? (
                        <img src={element.originalCropBase64} className="max-w-full max-h-40 object-contain shadow-sm" alt="Original" />
                    ) : (
                        <div className="text-gray-600 text-xs flex flex-col items-center">
                            <span className="opacity-50 text-center">No Crop Available.</span>
                        </div>
                    )}
                </div>
            </div>

            {!isText && (
                <div>
                    <h3 className="text-[10px] font-bold text-gray-500 mb-2 uppercase flex items-center gap-1">
                         Cleaned Result
                    </h3>
                    <div className="bg-checkerboard border border-gray-700 rounded-lg p-2 flex items-center justify-center min-h-[140px] relative overflow-hidden shadow-inner">
                        {element.cleanedImageBase64 ? (
                            <img src={element.cleanedImageBase64} className="max-w-full max-h-40 object-contain z-10 relative shadow-sm" alt="Cleaned" />
                        ) : (
                            <div className="text-gray-500 text-xs flex flex-col items-center z-10 text-center p-2">
                                 {isProcessing ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <RefreshCw className="animate-spin text-blue-500" size={24}/>
                                        <span className="text-blue-400 font-bold">Cleaning...</span>
                                    </div>
                                 ) : (
                                    <span className="opacity-50 italic">Awaiting AI agent...</span>
                                 )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
        
        {isText && isCompleted && (
            <div className="space-y-2">
                 <h3 className="text-xs font-semibold text-gray-400 uppercase">Extracted Text</h3>
                 <div className="p-3 bg-black border border-gray-800 rounded text-sm text-gray-200 font-mono break-words shadow-inner">
                    {element.textContent}
                 </div>
                 <div className="flex gap-2 text-xs bg-gray-800/50 p-2 rounded">
                    <span className="text-gray-500 flex items-center gap-1">
                        <Palette size={10}/> Color: <span style={{color: element.textColor}}>{element.textColor}</span>
                    </span>
                    <span className="text-gray-500 border-l border-gray-700 pl-2">Bold: {element.isBold ? 'Yes' : 'No'}</span>
                 </div>
            </div>
        )}

        {(hasHistory) && (
            <div className="border-t border-gray-800 pt-4">
                <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center justify-between w-full text-left mb-3 group"
                >
                    <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 group-hover:text-blue-400 transition-colors">
                        <Bug size={14} />
                        Audit Trail ({history.length})
                    </span>
                    {showHistory ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                </button>
                
                {showHistory && (
                    <div className="space-y-3">
                        {history.map((item, idx) => {
                            const isExpanded = expandedAttempt === idx;
                            const isSucc = item.qaScore !== undefined && item.qaScore >= 85;
                            return (
                                <div key={idx} className="bg-black/40 border border-gray-800 rounded overflow-hidden">
                                    <div 
                                        className="p-2 flex items-center justify-between cursor-pointer bg-gray-900/50 hover:bg-gray-800/50"
                                        onClick={() => setExpandedAttempt(isExpanded ? null : idx)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${
                                                isSucc ? 'bg-green-500' : 'bg-red-500'
                                            }`} />
                                            <span className="text-xs font-mono text-gray-300">Attempt #{item.attempt}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.qaScore !== undefined && (
                                                <span className={`text-[10px] font-bold ${
                                                    isSucc ? 'text-green-500' : 'text-red-500'
                                                }`}>
                                                    QA: {item.qaScore}
                                                </span>
                                            )}
                                            {isExpanded ? <ChevronDown size={12} className="text-gray-500"/> : <ChevronRight size={12} className="text-gray-500"/>}
                                        </div>
                                    </div>
                                    
                                    {isExpanded && (
                                        <div className="p-3 border-t border-gray-800 space-y-3 text-[10px]">
                                            <div>
                                                <span className="block text-blue-400 font-bold mb-1 uppercase tracking-tighter">Prompt:</span>
                                                <div className="bg-gray-950 p-2 rounded border border-gray-800 font-mono text-gray-300 break-words whitespace-pre-wrap leading-tight">
                                                    {item.prompt}
                                                </div>
                                            </div>
                                            {item.qaFeedback && (
                                                <div>
                                                    <span className="block text-gray-500 font-bold mb-1 uppercase tracking-tighter">Feedback:</span>
                                                    <div className={`p-2 rounded border leading-relaxed whitespace-pre-wrap ${
                                                        isSucc
                                                        ? 'bg-green-900/10 border-green-900/30 text-green-200' 
                                                        : 'bg-red-900/10 border-red-900/30 text-red-200'
                                                    }`}>
                                                        {item.qaFeedback}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-800 bg-gray-950 flex-shrink-0">
        {!isText ? (
            <button 
                onClick={handleRun}
                disabled={!canRun}
                className={`w-full flex items-center justify-center py-2.5 px-4 rounded-md font-bold text-xs uppercase tracking-wide transition-all shadow-lg ${
                    canRun 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 active:scale-95' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
            >
                {isProcessing ? (
                    <>
                        <RefreshCw size={14} className="animate-spin mr-2" />
                        AI Agent Processing...
                    </>
                ) : (
                    <>
                        <Play size={14} className="mr-2" />
                        {element.status === 'PENDING' ? 'Start AI Extraction' : (isUserModified ? 'Start Manual Retry Loop' : 'Restart Extraction Loop')}
                    </>
                )}
            </button>
        ) : (
             <div className="flex items-center justify-center gap-2 text-center text-xs text-gray-500 bg-gray-900 p-2 rounded border border-gray-800">
                <Info size={14}/>
                Text extracted via OCR
             </div>
        )}
      </div>
    </div>
  );
};
