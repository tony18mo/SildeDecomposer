
import React from 'react';
import { SlideElement } from '../types';

interface LayerOverlayProps {
  imageSrc: string;
  elements: SlideElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const LayerOverlay: React.FC<LayerOverlayProps> = ({ imageSrc, elements, selectedId, onSelect }) => {
  return (
    <div className="relative w-full h-full bg-dots-pattern overflow-auto p-8 flex items-center justify-center">
      {/* 
         CSS GRID STACK STRATEGY:
         By putting both the Image and the Overlay Div into the same Grid Cell (col-1 / row-1),
         we force the Overlay to be EXACTLY the size of the Image, pixel-for-pixel.
         This eliminates all 'inline-block' or 'flex' alignment drifts.
      */}
      <div className="grid place-items-center relative shadow-2xl ring-1 ring-gray-800 bg-gray-900">
        
        {/* Layer 1: The Reference Image (Driving dimensions) */}
        <img 
            src={imageSrc} 
            alt="Original Slide" 
            className="col-start-1 row-start-1 block max-w-full max-h-[85vh] object-contain select-none"
        />
        
        {/* Layer 2: The Coordinate Overlay (Locked to Layer 1 size) */}
        <div className="col-start-1 row-start-1 w-full h-full relative z-10 pointer-events-none">
          {elements.map((el) => {
            // Coordinate mapping: 0-1000 -> 0-100%
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
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(el.id);
                }}
                className={`absolute transition-all duration-200 cursor-pointer pointer-events-auto group box-border ${
                    isSelected 
                    ? `border-2 ${borderColor} bg-white/10 z-50 shadow-[0_0_15px_rgba(0,0,0,0.5)]` 
                    : 'border border-dashed border-gray-400/40 hover:border-solid hover:border-white/90 hover:bg-white/5 z-10'
                }`}
                style={{ top, left, width, height }}
              >
                {isSelected && (
                  <div className="absolute -top-6 left-0 flex flex-col pointer-events-none z-50">
                    <span className="text-[9px] font-black bg-black text-white px-2 py-0.5 rounded shadow-lg whitespace-nowrap uppercase tracking-tighter border border-gray-700">
                      {el.type}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
