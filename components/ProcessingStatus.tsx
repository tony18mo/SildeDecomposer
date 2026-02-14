
import React, { useEffect, useState } from 'react';
import { SlideElement, TokenStats, ElementType, TokenCounts, ModelMapping } from '../types';
import { CheckCircle2, CircleDashed, AlertCircle, Play, Layers, Cpu, ShieldCheck, Timer, Activity, Zap, Search, Sliders } from 'lucide-react';
import { CLEANING_MODELS, QA_MODELS, DETECTION_MODELS } from '../constants';

interface ProcessingStatusProps {
  elements: SlideElement[];
  selectedId: string | null;
  onSelectElement: (id: string) => void;
  onStartAll: () => void;
  canStart: boolean;
  tokenStats: TokenStats;
  modelMapping: ModelMapping;
  onMappingChange: (type: ElementType, model: string) => void;
  detectionModel?: string;
  onDetectionModelChange?: (model: string) => void;
  qaModel?: string;
  onQaModelChange?: (model: string) => void;
  parallelCount: number;
  onParallelCountChange: (count: number) => void;
  onRunSingleElement?: (id: string) => void;
  pipelineStartTime?: number;
  pipelineEndTime?: number;
  isProcessingGlobal?: boolean;
  currentAction?: string;
  currentActionStartTime?: number;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ 
  elements, 
  selectedId, 
  onSelectElement, 
  onStartAll,
  canStart,
  tokenStats,
  modelMapping,
  onMappingChange,
  detectionModel,
  onDetectionModelChange,
  qaModel,
  onQaModelChange,
  parallelCount,
  onParallelCountChange,
  onRunSingleElement,
  pipelineStartTime,
  pipelineEndTime,
  isProcessingGlobal,
  currentAction,
  currentActionStartTime
}) => {
  const [pipelineElapsed, setPipelineElapsed] = useState(0);
  const [actionElapsed, setActionElapsed] = useState(0);

  const completed = elements.filter(e => e.status === 'COMPLETED').length;
  const failed = elements.filter(e => e.status === 'FAILED').length;
  const total = elements.length;
  const progress = total === 0 ? 0 : Math.round(((completed + failed) / total) * 100);

  const totalInput = Object.values(tokenStats).reduce((acc: number, curr: TokenCounts) => acc + curr.input, 0);
  const totalOutput = Object.values(tokenStats).reduce((acc: number, curr: TokenCounts) => acc + curr.output, 0);

  useEffect(() => {
    let interval: number;
    if (isProcessingGlobal && pipelineStartTime) {
        setPipelineElapsed(Date.now() - pipelineStartTime);
        interval = window.setInterval(() => {
            setPipelineElapsed(Date.now() - pipelineStartTime);
        }, 100);
    } else if (pipelineEndTime && pipelineStartTime) {
        setPipelineElapsed(pipelineEndTime - pipelineStartTime);
    }
    return () => clearInterval(interval);
  }, [isProcessingGlobal, pipelineStartTime, pipelineEndTime]);

  useEffect(() => {
    let interval: number;
    if (currentAction && currentActionStartTime) {
        setActionElapsed(Date.now() - currentActionStartTime);
        interval = window.setInterval(() => {
            setActionElapsed(Date.now() - currentActionStartTime);
        }, 100);
    } else {
        setActionElapsed(0);
    }
    return () => clearInterval(interval);
  }, [currentAction, currentActionStartTime]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800 w-80 flex-shrink-0 z-10 overflow-hidden">
      <div className="p-4 border-b border-gray-800 bg-gray-950 flex justify-between items-center">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers size={20} className="text-blue-500"/>
            Pipeline
        </h2>
        {(isProcessingGlobal || pipelineEndTime) && (
            <div className="text-sm font-mono text-blue-400 flex items-center gap-1 bg-blue-900/20 px-2 py-1 rounded">
                <Timer size={14} />
                {formatTime(pipelineElapsed)}
            </div>
        )}
      </div>
      
      <div className="p-4 border-b border-gray-800 space-y-4 max-h-[450px] overflow-y-auto">
          
          {currentAction && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded p-2 flex items-start gap-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="mt-1">
                     <Activity size={14} className="text-blue-400 animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-0.5">Primary Task</p>
                      <p className="text-xs text-gray-200 font-medium leading-tight truncate">{currentAction}</p>
                  </div>
                  <div className="text-xs font-mono text-blue-300 font-bold">
                      {formatTime(actionElapsed)}
                  </div>
              </div>
          )}

          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>Overall Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div 
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Detection Model selector */}
            {onDetectionModelChange && detectionModel && (
                <div>
                    <label className="flex items-center text-[10px] uppercase font-bold text-gray-500 mb-1 gap-1">
                        <Search size={10} className="text-blue-400" />
                        Decomposition Model
                    </label>
                    <select 
                        value={detectionModel}
                        onChange={(e) => onDetectionModelChange(e.target.value)}
                        className="w-full bg-gray-800 text-xs text-gray-200 border border-gray-700 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-none"
                    >
                        {DETECTION_MODELS.map(m => (
                            <option key={m.id} value={m.id}>{m.name.split(' (')[0]}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Model Routing Section */}
            <div className="space-y-2">
                <label className="flex items-center text-[10px] uppercase font-bold text-gray-500 mb-1 gap-1">
                    <Zap size={10} className="text-amber-500" fill="currentColor"/>
                    Agent Routing (Cleaning)
                </label>
                
                {[ElementType.SHAPE, ElementType.ICON, ElementType.IMAGE].map((type) => (
                    <div key={type} className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-gray-400 font-medium w-12">{type}</span>
                        <select 
                            value={modelMapping[type as keyof ModelMapping]}
                            onChange={(e) => onMappingChange(type, e.target.value)}
                            className="flex-1 bg-gray-800 text-[10px] text-gray-300 border border-gray-700 rounded px-1.5 py-1 focus:border-blue-500 focus:outline-none"
                        >
                            {CLEANING_MODELS.map(m => (
                                <option key={m.id} value={m.id}>{m.name.replace(' (Fast)', '').replace(' (High Quality)', '')}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* Parallel Tasks */}
                <div>
                    <label className="flex items-center text-[10px] uppercase font-bold text-gray-500 mb-1 gap-1">
                        <Sliders size={10} className="text-purple-400" />
                        Parallel Workers
                    </label>
                    <input 
                        type="number"
                        min="1"
                        max="8"
                        value={parallelCount}
                        onChange={(e) => onParallelCountChange(parseInt(e.target.value) || 1)}
                        className="w-full bg-gray-800 text-xs text-gray-200 border border-gray-700 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-none"
                    />
                </div>

                {/* QA Model Selector */}
                {onQaModelChange && qaModel && (
                  <div>
                      <label className="flex items-center text-[10px] uppercase font-bold text-gray-500 mb-1 gap-1">
                          <ShieldCheck size={10} />
                          Critic Model
                      </label>
                      <select 
                          value={qaModel}
                          onChange={(e) => onQaModelChange(e.target.value)}
                          className="w-full bg-gray-800 text-xs text-gray-200 border border-gray-700 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-none"
                      >
                          {QA_MODELS.map(m => (
                              <option key={m.id} value={m.id}>{m.name.split(' (')[0]}</option>
                          ))}
                      </select>
                  </div>
                )}
            </div>
          </div>

          <button
            onClick={onStartAll}
            disabled={!canStart}
            className={`w-full flex items-center justify-center py-2 rounded text-sm font-bold transition-colors ${
                canStart 
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Play size={14} className="mr-2" />
            Start Decomposer
          </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-900">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 py-3 sticky top-0 bg-gray-900/95 backdrop-blur z-10">
            Layers ({elements.length})
        </h3>
        <div className="px-2 pb-2 space-y-1">
            {elements.map(el => {
                const isProcessing = el.status === 'PROCESSING' || el.status === 'RETRYING';
                const showPlayButton = el.type !== ElementType.TEXT && onRunSingleElement;

                return (
                    <div 
                        key={el.id} 
                        onClick={() => onSelectElement(el.id)}
                        className={`flex items-center p-2 rounded cursor-pointer transition-colors border group ${
                            selectedId === el.id 
                            ? 'bg-blue-900/30 border-blue-500/50 ring-1 ring-blue-500/30' 
                            : 'bg-gray-800/50 border-transparent hover:bg-gray-800'
                        }`}
                    >
                        <div className="mr-3">
                            {el.status === 'COMPLETED' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500"/>}
                            {isProcessing && <CircleDashed className="w-3.5 h-3.5 text-blue-500 animate-spin"/>}
                            {el.status === 'PENDING' && <div className="w-3.5 h-3.5 rounded-full border border-gray-600"/>}
                            {el.status === 'FAILED' && <AlertCircle className="w-3.5 h-3.5 text-red-500"/>}
                        </div>
                        <div className="flex-1 min-w-0 flex justify-between items-center">
                            <p className={`text-xs font-medium truncate ${selectedId === el.id ? 'text-white' : 'text-gray-300'}`}>
                                {el.type} <span className="text-gray-600 text-[10px]">#{el.id.slice(-4)}</span>
                            </p>
                            
                            <div className="flex items-center">
                                {el.processingDuration && (
                                    <span className="text-[9px] text-gray-500 font-mono mr-2">
                                        {(el.processingDuration / 1000).toFixed(1)}s
                                    </span>
                                )}
                                {showPlayButton && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectElement(el.id);
                                            if (onRunSingleElement && !isProcessing) {
                                                onRunSingleElement(el.id);
                                            }
                                        }}
                                        disabled={isProcessing}
                                        className={`ml-1 p-1 rounded transition-all ${
                                            isProcessing 
                                            ? 'opacity-0 cursor-default' 
                                            : 'opacity-0 group-hover:opacity-100 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white'
                                        }`}
                                    >
                                        <Play size={10} fill="currentColor" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

      <div className="border-t border-gray-800 bg-gray-950 p-4 text-[10px] text-gray-500">
        <div className="flex items-center gap-2 mb-2 text-blue-400 font-bold uppercase tracking-wider">
            <Cpu size={14} />
            Token Usage
        </div>
        <div className="space-y-1 mb-2">
            <div className="flex justify-between">
                <span>Total Input:</span>
                <span className="text-gray-300 font-mono">{totalInput.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
                <span>Total Output:</span>
                <span className="text-gray-300 font-mono">{totalOutput.toLocaleString()}</span>
            </div>
        </div>
        
        <div className="space-y-1 pt-2 border-t border-gray-900">
            {Object.entries(tokenStats).map(([model, stats]) => (
                <div key={model} className="flex justify-between">
                    <span className="truncate max-w-[150px]" title={model}>{model.replace('gemini-', '')}:</span>
                    <span className="text-gray-400 font-mono">{(stats as TokenCounts).total.toLocaleString()}</span>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};
