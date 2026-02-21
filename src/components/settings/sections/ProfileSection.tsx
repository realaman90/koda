'use client';

import { useState } from 'react';
import { User, Mail, Camera } from 'lucide-react';
import { toast } from 'sonner';

export function ProfileSection() {
  const [displayName, setDisplayName] = useState('User');
  const [email, setEmail] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const handleSave = () => {
    // In a real app, this would save to a backend
    toast.success('Profile saved');
    setIsDirty(false);
  };

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <button className="absolute bottom-0 right-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center border border-border hover:bg-muted/80 transition-colors">
            <Camera className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">{displayName}</h3>
          <p className="text-sm text-muted-foreground">
            {email || 'No email set'}
          </p>
        </div>
      </div>

      {/* Display Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Display Name</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setIsDirty(true);
            }}
            placeholder="Enter your name"
            className="w-full h-10 pl-10 pr-4 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          This name will be shown in shared projects
        </p>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setIsDirty(true);
            }}
            placeholder="Enter your email"
            className="w-full h-10 pl-10 pr-4 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Used for notifications when collaboration is enabled
        </p>
      </div>

      {/* Save Button */}
      {isDirty && (
        <button
          onClick={handleSave}
          className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-colors"
        >
          Save Changes
        </button>
      )}

      {/* Account Info */}
      <div className="pt-4 border-t border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">Account</h3>
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            You are using <span className="text-foreground font-medium">Local Mode</span>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            All data is stored locally in your browser. Sign up for cloud sync
            and collaboration features (coming soon).
          </p>
          <button
            disabled
            className="mt-4 px-4 py-2 bg-muted text-muted-foreground text-sm rounded-lg cursor-not-allowed"
          >
            Sign Up (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  );
}
