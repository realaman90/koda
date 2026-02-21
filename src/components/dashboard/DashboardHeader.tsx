'use client';

import { motion } from 'framer-motion';
import { Plus, Command } from 'lucide-react';
import { SyncStatusIndicator } from './SyncStatusIndicator';

interface DashboardHeaderProps {
  onCreateCanvas: () => void;
}

export function DashboardHeader({ onCreateCanvas }: DashboardHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-muted-foreground text-sm">Create a new project and start creating</p>
        <SyncStatusIndicator />
      </div>
      <div className="flex items-center gap-3">
        <motion.button
          onClick={onCreateCanvas}
          className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-medium rounded-lg cursor-pointer transition-all"
          style={{
            background: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)'
          }}
          whileHover={{ 
            scale: 1.02,
            boxShadow: '0 6px 20px rgba(245, 158, 11, 0.45)'
          }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="h-4 w-4" />
          New project
        </motion.button>
        
        {/* Keyboard shortcut hint */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground bg-secondary rounded-lg">
          <Command className="w-3 h-3" />
          <span>K</span>
        </div>
      </div>
    </div>
  );
}
