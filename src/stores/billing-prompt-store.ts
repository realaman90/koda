import { create } from 'zustand';

export interface BillingPromptDetails {
  message: string;
  required: number | null;
  balance: number | null;
}

interface BillingPromptState extends BillingPromptDetails {
  isOpen: boolean;
  open: (details?: Partial<BillingPromptDetails>) => void;
  close: () => void;
}

const DEFAULT_MESSAGE = 'You are out of credits. Please upgrade your plan to continue generating.';

const DEFAULT_DETAILS: BillingPromptDetails = {
  message: DEFAULT_MESSAGE,
  required: null,
  balance: null,
};

export const useBillingPromptStore = create<BillingPromptState>((set) => ({
  isOpen: false,
  ...DEFAULT_DETAILS,
  open: (details) =>
    set({
      isOpen: true,
      message: details?.message?.trim() || DEFAULT_MESSAGE,
      required: typeof details?.required === 'number' ? details.required : null,
      balance: typeof details?.balance === 'number' ? details.balance : null,
    }),
  close: () =>
    set({
      isOpen: false,
      ...DEFAULT_DETAILS,
    }),
}));

export function openBillingPrompt(details?: Partial<BillingPromptDetails>): void {
  useBillingPromptStore.getState().open(details);
}
