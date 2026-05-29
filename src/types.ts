export type UserRole = 'manager' | 'client' | 'payer';
export type PaymentFrequency = 'weekly' | 'biweekly' | 'monthly';
export type TransactionType = 'withdrawal' | 'reinvestment' | 'profit_withdrawal';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  interestRate?: number; // Only for clients
  paymentDay?: number; // Only for clients (day of month for monthly, day of week for weekly 1-7)
  paymentFrequency?: PaymentFrequency; // Only for clients
  managerId?: string; // For clients, who manages them
  payerEmail?: string; // For managers, to link a payer
  globalInterestRate?: number; // For managers, a global rate for the payer view
  createdAt: string;
}

export interface Deposit {
  id: string;
  clientId: string;
  clientEmail: string;
  amount: number;
  date: string;
  managerId: string;
  payerEmail?: string;
  type?: TransactionType;
  reinvestmentPairId?: string;
  profitDistributionId?: string;
  grossProfitAmount?: number;
  withdrawnProfitAmount?: number;
  reinvestedProfitAmount?: number;
}

export interface Payment {
  id: string;
  clientId: string;
  clientEmail: string;
  amount: number;
  date: string;
  managerId: string;
  payerEmail?: string;
  type?: TransactionType;
  reinvestmentPairId?: string;
  profitDistributionId?: string;
  grossProfitAmount?: number;
  withdrawnProfitAmount?: number;
  reinvestedProfitAmount?: number;
}

export interface ClientStats {
  totalInvested: number;
  currentBalance: number;
  periodProfit: number;
  projectedTotal: number;
  nextPaymentDate: Date;
  daysRemaining: number;
  isOverdue: boolean;
  isWarning: boolean;
  isPaid: boolean;
}
