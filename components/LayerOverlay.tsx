
import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import { SlideElement } from '../types';

interface LayerOverlayProps {
  imageSrc: string;
  elements: SlideElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdateBox?: (id: string, box: [number, number, number, number]) => void;
}

type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

export const LayerOverlay: React.FC<LayerOverlayProps> = ({ imageSrc, elements, selectedId, onSelect, onUpdateBox }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [dragInfo, setDragInfo] = useState<{
    id: string;
    type: HandleType;
    initialBox: [number, number, number, number];
    startX: number;
    startY: number;
  } | null>(null);

  const handleMouseDown = (e: ReactMouseEvent, id: string, type: HandleType) => {
    e.stopPropagation();
    const el = elements.find(item => item.id === id);
    if (!el) return;
    
    setDragInfo({
      id,
      type,
      initialBox: [...el.box_2d],
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragInfo || !imgRef.current) return;

      const rect = imgRef.current.getBoundingClientRect();
      const dx_norm = ((e.clientX - dragInfo.startX) / rect.width) * 1000;
      const dy_norm = ((e.clientY - dragInfo.startY) / rect.height) * 1000;

      let [ymin, xmin, ymax, xmax] = dragInfo.initialBox;

      switch (dragInfo.type) {
        case 'move':
          ymin += dy_norm; ymax += dy_norm; xmin += dx_norm; xmax += dx_norm;
          break;
        case 'nw': xmin += dx_norm; ymin += dy_norm; break;
        case 'n': ymin += dy_norm; break;
        case 'ne': xmax += dx_norm; ymin += dy_norm; break;
        case 'e': xmax += dx_norm; break;
        case 'se': xmax += dx_norm; ymax += dy_norm; break;
        case 's': ymax += dy_norm; break;
        case 'sw': xmin += dx_norm; ymax += dy_norm; break;
        case 'w': xmin += dx_norm; break;
      }

      // Constraints
      xmin = Math.max(0, Math.min(xmin, xmax - 10));
      ymin = Math.max(0, Math.min(ymin, ymax - 10));
      xmax = Math.min(1000, Math.max(xmax, xmin + 10));
      ymax = Math.min(1000, Math.max(ymax, ymin + 10));

      if (onUpdateBox) {
        onUpdateBox(dragInfo.id, [ymin, xmin, ymax, xmax]);
      }
    };

    const handleMouseUp = () => {
      setDragInfo(null);
    };

    if (dragInfo) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragInfo, onUpdateBox]);

  return (
    <div ref={containerRef} className="relative flex items-center justify-center w-full h-full bg-dots-pattern overflow-auto p-8">
      <div className="relative shadow-2xl ring-1 ring-gray-800 select-none max-w-full max-h-full flex justify-center items-center">
        <img 
            ref={imgRef}
            src={imageSrc} 
            alt="Original Slide" 
            className="object-contain"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
        
        {/* Interactive Overlay */}
        <div className="absolute inset-0">
          {elements.map((el) => {
            const top = `${el.box_2d[0] / 10}%`;
            const left = `${el.box_2d[1] / 10}%`;
            const height = `${(el.box_2d[2] - el.box_2d[0]) / 10}%`;
            const width = `${(el.box_2d[3] - el.box_2d[1]) / 10}%`;
            
            const isSelected = selectedId === el.id;

            let borderColor = "border-gray-500";
            if (el.type === 'TEXT') borderColor = "border-blue-400";
            if (el.type === 'SHAPE') borderColor = "border-purple-400";
            if (el.type === 'ICON') borderColor = "border-green-400";
            if (el.type === 'IMAGE') borderColor = "border-orange-400";

            return (
              <div
                key={el.id}
                onMouseDown={(e) => isSelected ? handleMouseDown(e, el.id, 'move') : onSelect(el.id)}
                className={`absolute transition-colors duration-200 cursor-pointer group ${
                    isSelected 
                    ? `border-2 ${borderColor} bg-white/10 z-20 shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-move` 
                    : 'border border-dashed border-gray-400/30 hover:border-solid hover:border-white/80 hover:bg-white/5 z-10'
                }`}
                style={{ top, left, width, height }}
              >
                {isSelected && (
                  <>
                    <span className="absolute -top-6 left-0 text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded shadow-lg whitespace-nowrap pointer-events-none">
                      {el.type} (Adjustable)
                    </span>
                    {/* Resize Handles */}
                    {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => (
                      <div
                        key={h}
                        onMouseDown={(e) => handleMouseDown(e, el.id, h as HandleType)}
                        className={`absolute w-3 h-3 bg-white border-2 ${borderColor.replace('border-', 'border-')} rounded-full shadow-md z-30 transition-transform hover:scale-125`}
                        style={{
                          top: h.includes('n') ? '-6px' : h.includes('s') ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                          left: h.includes('w') ? '-6px' : h.includes('e') ? 'calc(100% - 6px)' : 'calc(50% - 6px)',
                          cursor: `${h}-resize`
                        }}
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
