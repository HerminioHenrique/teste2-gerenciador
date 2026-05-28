import { 
  differenceInMonths, 
  differenceInWeeks,
  differenceInDays, 
  addMonths, 
  addWeeks,
  addDays,
  setDate, 
  setDay,
  isAfter, 
  startOfDay,
  endOfMonth
} from 'date-fns';
import { UserProfile, Deposit, Payment, ClientStats, PaymentFrequency } from '../types';

export function calculateCompoundInterest(
  amount: number,
  rate: number,
  startDate: Date,
  frequency: PaymentFrequency = 'monthly',
  currentDate: Date = new Date()
): number {
  let periods = 0;
  if (frequency === 'weekly') {
    periods = Math.max(0, differenceInWeeks(currentDate, startDate));
  } else if (frequency === 'biweekly') {
    periods = Math.max(0, Math.floor(differenceInDays(currentDate, startDate) / 14));
  } else {
    periods = Math.max(0, differenceInMonths(currentDate, startDate));
  }
  return amount * Math.pow(1 + rate / 100, periods);
}

export function getClientStats(
  client: UserProfile,
  deposits: Deposit[],
  payments: Payment[],
  overrideRate?: number,
  overrideFrequency?: PaymentFrequency,
  asOfDate?: Date
): ClientStats {
  const now = asOfDate ?? new Date();
  const rate = typeof client.interestRate === 'number' ? client.interestRate : parseFloat(client.interestRate as any || '0');
  const profitRate = typeof overrideRate === 'number' ? overrideRate : rate;
  const payDay = client.paymentDay || 1;
  const frequency = client.paymentFrequency || 'monthly';
  const displayFrequency = overrideFrequency || frequency;

  const getMonthlyDueDate = (referenceDate: Date, targetDay: number) => {
    const safeDay = Math.min(targetDay, endOfMonth(referenceDate).getDate());
    return setDate(referenceDate, safeDay);
  };

  const hasMatchingReinvestmentPayment = (deposit: Deposit) =>
    payments.some((payment) =>
      payment.type === 'reinvestment' &&
      (
        (deposit.reinvestmentPairId && payment.reinvestmentPairId === deposit.reinvestmentPairId) ||
        (
          !deposit.reinvestmentPairId &&
          !payment.reinvestmentPairId &&
          payment.clientId === deposit.clientId &&
          payment.managerId === deposit.managerId &&
          payment.amount === deposit.amount &&
          payment.date === deposit.date
        )
      )
    );

  const hasMatchingReinvestmentDeposit = (payment: Payment) =>
    deposits.some((deposit) =>
      deposit.type === 'reinvestment' &&
      (
        (payment.reinvestmentPairId && deposit.reinvestmentPairId === payment.reinvestmentPairId) ||
        (
          !payment.reinvestmentPairId &&
          !deposit.reinvestmentPairId &&
          deposit.clientId === payment.clientId &&
          deposit.managerId === payment.managerId &&
          deposit.amount === payment.amount &&
          deposit.date === payment.date
        )
      )
    );

  const effectiveDeposits = deposits.filter(
    (deposit) => deposit.type !== 'reinvestment' || hasMatchingReinvestmentPayment(deposit)
  );
  const effectivePayments = payments.filter(
    (payment) => payment.type !== 'reinvestment' || hasMatchingReinvestmentDeposit(payment)
  );

  const totalInvested = effectiveDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);

  const totalEffectivePaid = effectivePayments
    .filter(p => p.type !== 'reinvestment')
    .reduce((sum, p) => sum + p.amount, 0);

  // Current balance follows the business rule used in reapplies:
  // sum of all active tokens already credited minus actual withdrawals.
  const currentBalance = totalInvested - totalEffectivePaid;

  // Period profit projection (Next period's yield)
  const periodProfit = currentBalance * (profitRate / 100);

  const firstDepositDate = effectiveDeposits.length > 0 
    ? new Date(Math.min(...effectiveDeposits.map(d => new Date(d.date).getTime())))
    : null;

  const lastPayment = effectivePayments.length > 0 
    ? new Date(Math.max(...effectivePayments.map(p => new Date(p.date).getTime())))
    : null;

  let currentPaymentDate: Date;
  let nextPaymentDate: Date;
  let warningThreshold: number;

  if (displayFrequency === 'monthly') {
    currentPaymentDate = getMonthlyDueDate(now, payDay);
    nextPaymentDate = getMonthlyDueDate(addMonths(currentPaymentDate, 1), payDay);
    warningThreshold = 3;
  } else if (displayFrequency === 'weekly') {
    const targetPayDay = overrideFrequency ? 1 : payDay;
    const targetDay = (targetPayDay % 7);
    currentPaymentDate = setDay(now, targetDay);
    nextPaymentDate = addWeeks(currentPaymentDate, 1);
    warningThreshold = 1;
  } else {
    const anchor = new Date(client.createdAt);
    const daysSinceAnchor = differenceInDays(now, anchor);
    const periodsPassed = Math.max(0, Math.floor(daysSinceAnchor / 14));
    currentPaymentDate = addDays(anchor, periodsPassed * 14);
    nextPaymentDate = addDays(currentPaymentDate, 14);
    warningThreshold = 2;
  }

  const daysRemaining = Math.max(0, differenceInDays(currentPaymentDate, now));

  let isPaid = false;

  if (lastPayment) {
    if (displayFrequency === 'monthly') {
      isPaid =
        lastPayment.getMonth() === currentPaymentDate.getMonth() &&
        lastPayment.getFullYear() === currentPaymentDate.getFullYear();
    } else if (displayFrequency === 'weekly') {
      const currentWindowStart = addWeeks(currentPaymentDate, -1);
      isPaid =
        !isAfter(startOfDay(currentWindowStart), startOfDay(lastPayment)) &&
        isAfter(startOfDay(nextPaymentDate), startOfDay(lastPayment));
    } else {
      const currentWindowStart = addDays(currentPaymentDate, -14);
      isPaid =
        !isAfter(startOfDay(currentWindowStart), startOfDay(lastPayment)) &&
        isAfter(startOfDay(nextPaymentDate), startOfDay(lastPayment));
    }
  }
  
  // Overdue if:
  // 1. Not paid
  // 2. Today is on or after the due date (currentPaymentDate)
  // 3. The due date is AFTER the first deposit (you don't owe for periods before you invested)
  const isOverdue = !isPaid && 
                    firstDepositDate && 
                    isAfter(startOfDay(currentPaymentDate), startOfDay(firstDepositDate)) &&
                    (isAfter(startOfDay(now), startOfDay(currentPaymentDate)) || startOfDay(now).getTime() === startOfDay(currentPaymentDate).getTime());
  
  // Warning if not paid, not overdue, and close to the current due date
  // Also only if we have a deposit
  const isWarning = !isPaid && !isOverdue && firstDepositDate && daysRemaining <= warningThreshold;

  return {
    totalInvested,
    currentBalance,
    periodProfit,
    projectedTotal: currentBalance + periodProfit,
    nextPaymentDate: currentPaymentDate,
    daysRemaining,
    isOverdue,
    isWarning,
    isPaid,
  };
}
