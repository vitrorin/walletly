export interface Participant {
  id: string;
  name: string;
  percentage: number;
  paid: boolean;
  paymentIntentId?: string; // set after a successful Stripe charge
}

export type TakeoutApp = 'doordash' | 'ubereats' | 'grubhub' | 'instacart' | 'other';

export interface Bill {
  id: string;
  code: string;
  title: string;
  totalAmount: number;
  createdAt: number;
  participants: Participant[];
  takeoutApp?: TakeoutApp;
  orderLink?: string; // tracking URL pasted from the takeout app
  eta?: number;       // Unix ms timestamp
}
