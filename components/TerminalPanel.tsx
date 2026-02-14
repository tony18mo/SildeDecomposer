
import React, { useEffect, useRef, useState } from 'react';
import { Terminal, ChevronUp, ChevronDown, Trash2, XCircle, Maximize2, Minimize2, Copy } from 'lucide-react';

interface TerminalPanelProps {
  logs: string[];
  onClear: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ logs, onClear }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen, isMaximized]);

  const heightClass = !isOpen 
    ? 'h-10' 
    : isMaximized 
        ? 'h-[80vh]' 
        : 'h-64';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(logs.join('\n'));
  };

  return (
    <div className={`absolute bottom-0 left-0 right-0 bg-black border-t border-gray-800 shadow-2xl transition-all duration-300 z-30 flex flex-col ${heightClass}`}>
      
      {/* Terminal Header */}
      <div 
        className="flex items-center justify-between px-4 h-10 bg-gray-900 border-b border-gray-800 cursor-pointer select-none hover:bg-gray-800 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-blue-400">
                <Terminal size={14} />
                <span className="text-xs font-bold uppercase tracking-wider">Debug Console</span>
            </div>
            {logs.length > 0 && (
                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-gray-700">
                    {logs.length} events
                </span>
            )}
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button 
                onClick={copyToClipboard}
                className="p-1.5 text-gray-500 hover:text-white rounded hover:bg-gray-700" 
                title="Copy All"
            >
                <Copy size={12} />
            </button>
            <button 
                onClick={onClear}
                className="p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-gray-700" 
                title="Clear Console"
            >
                <Trash2 size={12} />
            </button>
            <div className="w-px h-4 bg-gray-700 mx-1"></div>
            {isOpen && (
                <button 
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="p-1.5 text-gray-500 hover:text-white rounded hover:bg-gray-700"
                >
                    {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>
            )}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="p-1.5 text-gray-500 hover:text-white rounded hover:bg-gray-700"
            >
                {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
        </div>
      </div>

      {/* Terminal Body */}
      {isOpen && (
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-black/95 backdrop-blur-sm">
            {logs.length === 0 ? (
                <div className="text-gray-600 italic">Waiting for process logs...</div>
            ) : (
                <div className="space-y-1.5">
                    {logs.map((log, i) => {
                        const isError = log.toLowerCase().includes('fail') || log.toLowerCase().includes('error');
                        const isSuccess = log.toLowerCase().includes('complete') || log.toLowerCase().includes('pass') || log.toLowerCase().includes('success');
                        const isInfo = log.includes('Agent') || log.includes('Pipeline');

                        return (
                            <div key={i} className="flex gap-3 leading-relaxed border-b border-gray-900/50 pb-0.5 last:border-0 hover:bg-white/5 px-2 -mx-2 rounded">
                                <span className="text-gray-600 select-none min-w-[24px] text-right opacity-50">{i + 1}</span>
                                <span className="text-gray-600 select-none opacity-50">
                                    [{new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' })}]
                                </span>
                                <span className={`break-all ${
                                    isError ? 'text-red-400 font-bold' : 
                                    isSuccess ? 'text-green-400' : 
                                    isInfo ? 'text-blue-300' : 
                                    'text-gray-300'
                                }`}>
                                    {log}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
            <div ref={endRef} />
        </div>
      )}
    </div>
  );
};
