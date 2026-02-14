import React, { ChangeEvent } from 'react';
import { UploadCloud } from 'lucide-react';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFileSelect }) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto mt-10">
      <label 
        htmlFor="file-upload" 
        className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-900 hover:bg-gray-800 transition-colors"
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadCloud className="w-12 h-12 mb-4 text-blue-500" />
          <p className="mb-2 text-sm text-gray-400">
            <span className="font-semibold text-white">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">PNG, JPG or PDF Screenshot (MAX. 10MB)</p>
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
  );
};