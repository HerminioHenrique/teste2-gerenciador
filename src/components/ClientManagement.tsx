import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Edit2,
  History,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { db } from '../firebase';
import { UserProfile, Deposit, Payment, PaymentFrequency } from '../types';
import { getClientStats } from '../utils/calculations';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';

interface ClientManagementProps {
  manager: UserProfile;
  clientId: string;
  onBack: () => void;
}

interface ConfirmModalState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export default function ClientManagement({ manager, clientId, onBack }: ClientManagementProps) {
  const [client, setClient] = useState<UserProfile | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState('');
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [editRate, setEditRate] = useState(0);
  const [editPayDay, setEditPayDay] = useState(0);
  const [editFrequency, setEditFrequency] = useState<PaymentFrequency>('monthly');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [editingTransaction, setEditingTransaction] = useState<{
    type: 'deposits' | 'payments';
    id: string;
    amount: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    if (!clientId) return;

    const unsubClient = onSnapshot(
      doc(db, 'users', clientId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setClient(data);
          setEditRate(data.interestRate || 0);
          setEditPayDay(data.paymentDay || 1);
          setEditFrequency(data.paymentFrequency || 'monthly');
        }
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${clientId}`);
      }
    );

    const qDeposits = query(
      collection(db, 'deposits'),
      where('clientId', '==', clientId),
      where('managerId', '==', manager.uid)
    );
    const unsubDeposits = onSnapshot(
      qDeposits,
      (snapshot) => {
        const docs = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as Deposit));
        setDeposits(docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'deposits');
      }
    );

    const qPayments = query(
      collection(db, 'payments'),
      where('clientId', '==', clientId),
      where('managerId', '==', manager.uid)
    );
    const unsubPayments = onSnapshot(
      qPayments,
      (snapshot) => {
        const docs = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as Payment));
        setPayments(docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'payments');
      }
    );

    return () => {
      unsubClient();
      unsubDeposits();
      unsubPayments();
    };
  }, [clientId, manager.uid]);

  if (loading || !client) return <div className="p-8 text-center">Carregando...</div>;

  const stats = getClientStats(client, deposits, payments);

  const findPairedDepositForReinvestment = (payment: Payment) =>
    deposits.find(
      (deposit) =>
        deposit.type === 'reinvestment' &&
        ((payment.reinvestmentPairId && deposit.reinvestmentPairId === payment.reinvestmentPairId) ||
          (!payment.reinvestmentPairId &&
            deposit.clientId === payment.clientId &&
            deposit.managerId === payment.managerId &&
            deposit.amount === payment.amount &&
            deposit.date === payment.date))
    );

  const findPairedPaymentForReinvestment = (deposit: Deposit) =>
    payments.find(
      (payment) =>
        payment.type === 'reinvestment' &&
        ((deposit.reinvestmentPairId && payment.reinvestmentPairId === deposit.reinvestmentPairId) ||
          (!deposit.reinvestmentPairId &&
            payment.clientId === deposit.clientId &&
            payment.managerId === deposit.managerId &&
            payment.amount === deposit.amount &&
            payment.date === deposit.date))
    );

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  const openConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ open: true, title, message, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmModal((prev) => ({ ...prev, open: false }));
  };

  const handleAddDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || !client) return;

    try {
      await addDoc(collection(db, 'deposits'), {
        clientId,
        clientEmail: client.email,
        managerId: manager.uid,
        payerEmail: manager.payerEmail || '',
        amount: parseFloat(depositAmount),
        date: new Date(`${depositDate}T12:00:00`).toISOString(),
      });
      setDepositAmount('');
      setDepositDate(new Date().toISOString().split('T')[0]);
      showSuccess('Depósito realizado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar depósito:', error);
      showError('Erro ao adicionar depósito.');
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !client) return;

    try {
      await addDoc(collection(db, 'payments'), {
        clientId,
        clientEmail: client.email,
        managerId: manager.uid,
        payerEmail: manager.payerEmail || '',
        amount: parseFloat(paymentAmount),
        date: new Date(`${paymentDate}T12:00:00`).toISOString(),
      });
      setPaymentAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      showSuccess('Pagamento registrado com sucesso!');
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      showError('Erro ao registrar pagamento.');
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await updateDoc(doc(db, 'users', clientId), {
        interestRate: editRate,
        paymentDay: editPayDay,
        paymentFrequency: editFrequency,
      });
      showSuccess('Configurações atualizadas!');
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      showError('Erro ao atualizar configurações.');
    }
  };

  const handleEditTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    try {
      const nextAmount = parseFloat(editingTransaction.amount);
      const nextDate = new Date(`${editingTransaction.date}T12:00:00`).toISOString();
      const batch = writeBatch(db);

      batch.update(doc(db, editingTransaction.type, editingTransaction.id), {
        amount: nextAmount,
        date: nextDate,
      });

      if (editingTransaction.type === 'payments') {
        const payment = payments.find((item) => item.id === editingTransaction.id);
        if (payment?.type === 'reinvestment') {
          const pairedDeposit = findPairedDepositForReinvestment(payment);
          if (pairedDeposit) {
            batch.update(doc(db, 'deposits', pairedDeposit.id), {
              amount: nextAmount,
              date: nextDate,
            });
          }
        }
      } else {
        const deposit = deposits.find((item) => item.id === editingTransaction.id);
        if (deposit?.type === 'reinvestment') {
          const pairedPayment = findPairedPaymentForReinvestment(deposit);
          if (pairedPayment) {
            batch.update(doc(db, 'payments', pairedPayment.id), {
              amount: nextAmount,
              date: nextDate,
            });
          }
        }
      }

      await batch.commit();
      setEditingTransaction(null);
      showSuccess('Transação atualizada!');
    } catch (error) {
      console.error('Erro ao editar transação:', error);
      showError('Erro ao editar transação.');
    }
  };

  const handleReinvest = () => {
    const profit = stats.periodProfit;
    if (profit <= 0) {
      showError('Não há rendimento para reaplicar neste período.');
      return;
    }

    openConfirm(
      'Reaplicar Rendimentos',
      `Reaplicar ${profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}? O período atual será marcado como pago e os tokens permanecerão ativos.`,
      async () => {
        try {
          const pairId = crypto.randomUUID();
          const now = new Date().toISOString();
          const batch = writeBatch(db);
          const paymentRef = doc(collection(db, 'payments'));
          const depositRef = doc(collection(db, 'deposits'));

          batch.set(paymentRef, {
            clientId,
            clientEmail: client.email,
            managerId: manager.uid,
            payerEmail: manager.payerEmail || '',
            amount: profit,
            date: now,
            type: 'reinvestment',
            reinvestmentPairId: pairId,
          });

          batch.set(depositRef, {
            clientId,
            clientEmail: client.email,
            managerId: manager.uid,
            payerEmail: manager.payerEmail || '',
            amount: profit,
            date: now,
            type: 'reinvestment',
            reinvestmentPairId: pairId,
          });

          await batch.commit();
          showSuccess('Tokens reaplicados com sucesso! Período marcado como pago.');
        } catch (error) {
          console.error('Erro ao reaplicar:', error);
          showError('Erro ao reaplicar.');
        }
      }
    );
  };

  const handleDeleteTransaction = (type: 'deposits' | 'payments', id: string) => {
    openConfirm(
      'Excluir Transação',
      'Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.',
      async () => {
        try {
          const batch = writeBatch(db);
          let removedLinkedReinvestment = false;

          if (type === 'payments') {
            const payment = payments.find((item) => item.id === id);
            if (payment?.type === 'reinvestment') {
              const pairedDeposit = findPairedDepositForReinvestment(payment);
              if (pairedDeposit) {
                batch.delete(doc(db, 'deposits', pairedDeposit.id));
                removedLinkedReinvestment = true;
              }
            }
          } else {
            const deposit = deposits.find((item) => item.id === id);
            if (deposit?.type === 'reinvestment') {
              const pairedPayment = findPairedPaymentForReinvestment(deposit);
              if (pairedPayment) {
                batch.delete(doc(db, 'payments', pairedPayment.id));
                removedLinkedReinvestment = true;
              }
            }
          }

          batch.delete(doc(db, type, id));
          await batch.commit();

          showSuccess(
            removedLinkedReinvestment
              ? 'Reaplicação excluída por completo!'
              : 'Transação excluída com sucesso!'
          );
        } catch (error: any) {
          console.error('Erro ao excluir:', error);
          showError(`Erro ao excluir: ${error?.message || 'Sem permissão.'}`);
        }
      }
    );
  };

  const chartData = Array.from({ length: 12 }).map((_, i) => {
    const monthDate = new Date();
    monthDate.setMonth(monthDate.getMonth() + i);
    const projectedBalance = stats.currentBalance * Math.pow(1 + (client.interestRate || 0) / 100, i);
    return {
      name: monthDate.toLocaleDateString('pt-BR', { month: 'short' }),
      balance: Math.round(projectedBalance),
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-emerald-600 transition-colors font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para Lista
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <p className="text-sm text-gray-500">{client.email}</p>
        </div>
      </div>

      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 fixed top-20 right-8 z-[100]"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold">{successMsg}</span>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 fixed top-20 right-8 z-[100]"
          >
            <AlertCircle className="w-5 h-5" />
            <span className="font-bold">{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total de Tokens</p>
          <h3 className="text-xl font-bold text-gray-900">
            {stats.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h3>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl shadow-sm border border-emerald-100">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Saldo Atual</p>
          <h3 className="text-xl font-bold text-emerald-700">
            {stats.currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            {client.paymentFrequency === 'weekly'
              ? 'Previsto p/ Semana'
              : client.paymentFrequency === 'biweekly'
                ? 'Previsto p/ Quinzena'
                : 'Total Previsto'}
          </p>
          <h3 className="text-xl font-bold text-purple-600">
            {stats.projectedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h3>
          <p className="text-[10px] text-gray-400 mt-1">Saldo + Rendimento Est.</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Próximo Pagto</p>
          <h3
            className={`text-xl font-bold ${
              stats.isOverdue
                ? 'text-red-600'
                : stats.isPaid
                  ? 'text-emerald-600'
                  : stats.isWarning
                    ? 'text-orange-500'
                    : 'text-gray-900'
            }`}
          >
            {stats.nextPaymentDate.toLocaleDateString('pt-BR')}
          </h3>
          <div className="mt-1 flex items-center gap-1">
            {stats.isPaid ? (
              <span className="text-[10px] text-emerald-600 font-bold uppercase flex items-center gap-0.5">
                <CheckCircle2 className="w-2.5 h-2.5" /> Pago
              </span>
            ) : stats.isOverdue ? (
              <span className="text-[10px] text-red-600 font-bold uppercase flex items-center gap-0.5 animate-pulse">
                <AlertCircle className="w-2.5 h-2.5" /> Vencido
              </span>
            ) : stats.isWarning ? (
              <span className="text-[10px] text-orange-500 font-bold uppercase flex items-center gap-0.5">
                <Clock className="w-2.5 h-2.5" /> Próximo
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 uppercase">{stats.daysRemaining} dias restantes</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Novo Aporte
            </h3>
            <form onSubmit={handleAddDeposit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor (R$)"
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <input
                  type="date"
                  required
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <button className="w-full bg-emerald-600 text-white py-2 rounded-lg font-semibold hover:bg-emerald-700 transition-colors">
                Confirmar Depósito
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Minus className="w-5 h-5 text-blue-600" />
              Registrar Pagamento
            </h3>
            <form onSubmit={handleAddPayment} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor (R$)"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  className="bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Pagar
                </button>
                <button
                  type="button"
                  onClick={handleReinvest}
                  className="bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reaplicar
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-400" />
              Configurações
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                  {editFrequency === 'weekly'
                    ? 'Taxa Semanal (%)'
                    : editFrequency === 'biweekly'
                      ? 'Taxa Quinzenal (%)'
                      : 'Taxa Mensal (%)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editRate}
                  onChange={(e) => setEditRate(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Frequência</label>
                <select
                  value={editFrequency}
                  onChange={(e) => setEditFrequency(e.target.value as PaymentFrequency)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="monthly">Mensal</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="weekly">Semanal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                  {editFrequency === 'monthly'
                    ? 'Dia do Mês'
                    : editFrequency === 'weekly'
                      ? 'Dia da Semana (1-7)'
                      : 'Dia de Início (Automático)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max={editFrequency === 'monthly' ? 31 : 7}
                  value={editPayDay}
                  onChange={(e) => setEditPayDay(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  disabled={editFrequency === 'biweekly'}
                />
              </div>
              <button
                onClick={handleUpdateSettings}
                className="w-full bg-gray-900 text-white py-2 rounded-lg font-semibold hover:bg-black transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Projeção de Crescimento (12 meses)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) =>
                      value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    }
                  />
                  <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-400" />
                Histórico de Transações
              </h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
              <div className="p-4 sm:p-6">
                <h4 className="text-sm font-bold text-emerald-600 uppercase mb-4">Adições de Tokens</h4>
                <div className="space-y-3">
                  {deposits
                    .filter((deposit) => deposit.type !== 'reinvestment')
                    .map((deposit) => (
                      <div key={deposit.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg group">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {deposit.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          <p className="text-xs text-gray-500">{new Date(deposit.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() =>
                              setEditingTransaction({
                                type: 'deposits',
                                id: deposit.id,
                                amount: deposit.amount.toString(),
                                date: new Date(deposit.date).toISOString().split('T')[0],
                              })
                            }
                            className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction('deposits', deposit.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  {deposits.filter((deposit) => deposit.type !== 'reinvestment').length === 0 && (
                    <p className="text-xs text-gray-400 italic">Nenhum token adicionado.</p>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-6">
                <h4 className="text-sm font-bold text-blue-600 uppercase mb-4">Retiradas / Pagamentos</h4>
                <div className="space-y-3">
                  {payments
                    .filter((payment) => payment.type !== 'reinvestment')
                    .map((payment) => (
                      <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg group">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900">
                            {payment.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          <p className="text-xs text-gray-500">{new Date(payment.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() =>
                              setEditingTransaction({
                                type: 'payments',
                                id: payment.id,
                                amount: payment.amount.toString(),
                                date: new Date(payment.date).toISOString().split('T')[0],
                              })
                            }
                            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction('payments', payment.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  {payments.filter((payment) => payment.type !== 'reinvestment').length === 0 && (
                    <p className="text-xs text-gray-400 italic">Nenhuma retirada realizada.</p>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-6 bg-purple-50/10">
                <h4 className="text-sm font-bold text-purple-600 uppercase mb-4">Tokens Reaplicados</h4>
                <div className="space-y-3">
                  {payments
                    .filter((payment) => payment.type === 'reinvestment')
                    .map((payment) => (
                      <div
                        key={payment.id}
                        className="flex justify-between items-center p-3 bg-purple-50/50 border border-purple-100 rounded-lg group hover:bg-purple-100/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-purple-700">
                            {payment.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          <p className="text-xs text-purple-500">{new Date(payment.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() =>
                              setEditingTransaction({
                                type: 'payments',
                                id: payment.id,
                                amount: payment.amount.toString(),
                                date: new Date(payment.date).toISOString().split('T')[0],
                              })
                            }
                            className="p-1.5 text-purple-400 hover:text-purple-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction('payments', payment.id)}
                            className="p-1.5 text-purple-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  {payments.filter((payment) => payment.type === 'reinvestment').length === 0 && (
                    <p className="text-xs text-gray-400 italic">Nenhum token reaplicado.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editingTransaction && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">
                  Editar {editingTransaction.type === 'deposits' ? 'Adição de Tokens' : 'Transação'}
                </h3>
                <button
                  onClick={() => setEditingTransaction(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleEditTransaction} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingTransaction.amount}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={editingTransaction.date}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingTransaction(null)}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal.open && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
                <p className="text-sm text-gray-500">{confirmModal.message}</p>
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={closeConfirm}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    closeConfirm();
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
