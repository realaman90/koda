import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play, Sliders, Video, Type, Image as ImageIcon, Volume2, ChevronDown } from 'lucide-react';

export function VideoGeneratorNodeNew({ selected }: { selected?: boolean; data?: any }) {
  return (
    <div className={`relative w-[380px] bg-[#1E1E1E] rounded-[16px] border ${selected ? 'border-[#3B82F6]' : 'border-neutral-800'} shadow-xl font-sans`}>
      <style>{`
        /* Safely preventing any background override on focus */
        .video-generator-textarea {
          background-color: transparent !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          color: white !important;
          resize: none !important;
        }
        .video-generator-textarea:focus {
          background-color: transparent !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>

      {/* 2. Header Section (Top Bar) */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-neutral-800/80">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-gray-300" />
          <span className="text-gray-300 font-medium text-sm tracking-wide">Video Generator 1</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="text-gray-400 hover:text-white hover:bg-neutral-800/80 p-1.5 rounded-md transition-colors flex items-center justify-center">
            <Play className="w-4 h-4" />
          </button>
          <button className="text-gray-400 hover:text-white hover:bg-neutral-800/80 p-1.5 rounded-md transition-colors flex items-center justify-center">
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* 3. Body Section (Preview Area) */}
        <div className="w-full h-[180px] bg-[#141414] rounded-lg border border-neutral-800/50 flex items-center justify-center overflow-hidden">
          {/* Empty rectangular area / placeholder for video */}
        </div>

        {/* 4. Input Section (The "Subtle" Text Area) */}
        <div className="mt-4">
          <textarea
            className="video-generator-textarea w-full text-[15px] placeholder-neutral-500"
            rows={2}
            placeholder="Describe the video you want to generate..."
          />
        </div>

        {/* 5. Footer Section (Settings Row) */}
        <div className="mt-3 flex items-center bg-[#2A2A2A] rounded-full p-1 w-max">
          <div className="flex items-center gap-1 text-[11px] font-medium text-gray-300 hover:text-white cursor-pointer px-2.5 py-1 border-r border-neutral-700/60">
            <span>Veo 3.1 Fast Imag...</span>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-gray-300 hover:text-white cursor-pointer px-2.5 py-1 border-r border-neutral-700/60">
            <span>16:9</span>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-gray-300 hover:text-white cursor-pointer px-2.5 py-1 border-r border-neutral-700/60">
            <span>8s</span>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-gray-300 hover:text-white cursor-pointer px-2.5 py-1 border-r border-neutral-700/60">
            <span>1080p</span>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </div>
          <div className="flex items-center text-gray-300 hover:text-white cursor-pointer px-2.5 py-1">
            <Volume2 className="w-3.5 h-3.5 text-gray-400 hover:text-white transition-colors" />
          </div>
        </div>
      </div>

      {/* 6. Node Handles */}
      {/* Inputs (Left Edge) */}
      <div className="absolute -left-[14px] top-[100px]">
        <Handle
          type="target"
          position={Position.Left}
          id="text"
          className="!relative !transform-none !w-7 !h-7 !bg-[#1E1E1E] !border-[2px] !border-neutral-700 !rounded-full flex items-center justify-center hover:!border-blue-400 transition-colors"
        >
          <Type className="w-3 h-3 text-gray-400 pointer-events-none" />
        </Handle>
      </div>

      <div className="absolute -left-[14px] top-[140px]">
        <Handle
          type="target"
          position={Position.Left}
          id="image"
          className="!relative !transform-none !w-7 !h-7 !bg-[#1E1E1E] !border-[2px] !border-neutral-700 !rounded-full flex items-center justify-center hover:!border-blue-400 transition-colors"
        >
          <ImageIcon className="w-3 h-3 text-gray-400 pointer-events-none" />
        </Handle>
      </div>

      {/* Output (Right Edge) */}
      <div className="absolute -right-[14px] top-[120px]">
        <Handle
          type="source"
          position={Position.Right}
          id="videoOut"
          className="!relative !transform-none !w-7 !h-7 !bg-[#1E1E1E] !border-[2px] !border-neutral-700 !rounded-full flex items-center justify-center hover:!border-blue-400 transition-colors"
        >
          <Video className="w-3 h-3 text-gray-400 pointer-events-none" />
        </Handle>
      </div>
    </div>
  );
}
