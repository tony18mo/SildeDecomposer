
import React, { ChangeEvent } from 'react';
import { UploadCloud, Cpu, ShieldCheck, ExternalLink, Key, Zap, Info } from 'lucide-react';
import { DETECTION_MODELS } from '../constants';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  detectionModel: string;
  onDetectionModelChange: (model: string) => void;
  hasApiKey: boolean;
  onSelectKey: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ 
  onFileSelect, 
  detectionModel, 
  onDetectionModelChange,
  hasApiKey,
  onSelectKey
}) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row gap-8 items-stretch animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Upload Panel */}
      <div className="flex-1">
        <label 
          htmlFor="file-upload" 
          className="flex flex-col items-center justify-center w-full h-full min-h-[350px] border-2 border-gray-800 border-dashed rounded-2xl cursor-pointer bg-gray-900/50 hover:bg-gray-800/50 hover:border-blue-500/50 transition-all group overflow-hidden relative shadow-2xl"
        >
          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-col items-center justify-center pt-5 pb-6 relative z-10">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
              <UploadCloud className="w-10 h-10 text-blue-500" />
            </div>
            <p className="mb-2 text-lg text-gray-200">
              <span className="font-bold text-white">Upload Screenshot</span>
            </p>
            <p className="text-sm text-gray-500">Drag & drop or click to browse</p>
            <p className="mt-4 text-[10px] text-gray-600 uppercase font-bold tracking-widest bg-black/40 px-3 py-1 rounded-full border border-gray-800">
              PNG, JPG or PDF • MAX 10MB
            </p>
          </div>
          <input 
            id="file-upload" 
            type="file" 
            className="hidden" 
            accept="image/*"
            onChange={handleChange}
          />
        </label>
      </div>

      {/* Configuration Panel */}
      <div className="w-full md:w-80 flex flex-col gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Cpu size={18} className="text-blue-500" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Agent Settings</h3>
          </div>

          <div className="space-y-6 flex-1">
            {/* Model Selection */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Zap size={10} className="text-amber-500" fill="currentColor" />
                Decomposition Engine
              </label>
              <div className="space-y-2">
                {DETECTION_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => onDetectionModelChange(model.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      detectionModel === model.id 
                        ? 'bg-blue-600/10 border-blue-500 text-blue-100 ring-1 ring-blue-500/50' 
                        : 'bg-black/30 border-gray-800 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{model.name.split(' (')[0]}</div>
                    <div className="text-[10px] opacity-60 mt-0.5">{model.id.includes('pro') ? 'High Precision Reasoning' : 'Optimized for Speed'}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* API Key / Billing */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Key size={10} className="text-blue-400" />
                Cloud Credits & Billing
              </label>
              <div className="bg-black/40 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-medium text-gray-400">Status</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    hasApiKey 
                      ? 'bg-green-950/30 border-green-900/50 text-green-400' 
                      : 'bg-amber-950/30 border-amber-900/50 text-amber-400'
                  }`}>
                    {hasApiKey ? 'Pro Credits Active' : 'Limited Access'}
                  </span>
                </div>
                
                <button 
                  onClick={onSelectKey}
                  className="w-full py-2 px-3 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-lg border border-gray-700 transition-colors flex items-center justify-center gap-2 mb-3 shadow-sm"
                >
                  <ShieldCheck size={14} className="text-blue-500" />
                  {hasApiKey ? 'Change Account / Key' : 'Connect Google Cloud'}
                </button>

                <div className="flex flex-col gap-2">
                  <a 
                    href="https://ai.google.dev/gemini-api/docs/billing" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[9px] text-gray-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
                  >
                    <Info size={10} />
                    Learn about API billing
                    <ExternalLink size={8} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-gray-800">
            <div className="flex items-center gap-3 text-gray-500">
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                 <Zap size={14} />
              </div>
              <div className="text-[10px] leading-tight font-medium">
                Higher extraction quality is achieved with <span className="text-gray-300">Gemini 3 Pro</span> and a connected billing account.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
