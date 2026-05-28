import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Deposit, Payment } from '../types';
import { getClientStats } from '../utils/calculations';
import {
  TrendingUp,
  DollarSign,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Info,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { addMonths } from 'date-fns';

interface ClientDashboardProps {
  client: UserProfile;
}

export default function ClientDashboard({ client }: ClientDashboardProps) {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client.email) return;

    const qDeposits = query(
      collection(db, 'deposits'),
      where('clientEmail', '==', client.email)
    );
    const unsubDeposits = onSnapshot(qDeposits, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Deposit));
      setDeposits(docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'deposits');
    });

    const qPayments = query(
      collection(db, 'payments'),
      where('clientEmail', '==', client.email)
    );
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      const docs = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id } as Payment));
      setPayments(docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'payments');
    });

    return () => {
      unsubDeposits();
      unsubPayments();
    };
  }, [client.email]);

  if (loading) return <div className="p-8 text-center">Carregando seus dados...</div>;

  const stats = getClientStats(client, deposits, payments);
  const hasRate = client.interestRate !== undefined && client.interestRate !== null;
  const currentRate = hasRate ? Number(client.interestRate) : 0;

  const chartData = Array.from({ length: 13 }).map((_, i) => {
    const monthOffset = i - 6;
    const targetDate = addMonths(new Date(), monthOffset);
    const depositsUntilDate = deposits.filter((deposit) => new Date(deposit.date) <= targetDate);
    const paymentsUntilDate = payments.filter((payment) => new Date(payment.date) <= targetDate);
    const statsAtDate = getClientStats(client, depositsUntilDate, paymentsUntilDate, undefined, undefined, targetDate);
    let balanceAtDate = statsAtDate.currentBalance;

    if (monthOffset > 0) {
      balanceAtDate = stats.currentBalance * Math.pow(1 + currentRate / 100, monthOffset);
    }

    return {
      name: targetDate.toLocaleDateString('pt-BR', { month: 'short' }),
      balance: Math.max(0, Math.round(balanceAtDate)),
      isProjection: monthOffset > 0,
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Olá, {client.name.split(' ')[0]}!</h1>
          <p className="text-gray-500">Acompanhe o crescimento do seu patrimônio.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-medium text-gray-600">
            {stats.isPaid ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Pago
              </span>
            ) : stats.isOverdue ? (
              <span className="text-red-600 font-bold flex items-center gap-1 animate-pulse">
                <AlertCircle className="w-4 h-4" /> Vencido
              </span>
            ) : stats.isWarning ? (
              <span className="text-orange-500 font-bold flex items-center gap-1">
                <Clock className="w-4 h-4" /> Próximo pagamento em {stats.daysRemaining} {stats.daysRemaining === 1 ? 'dia' : 'dias'}
              </span>
            ) : (
              <>Próximo pagamento em <span className="text-emerald-600 font-bold">{stats.daysRemaining} dias</span></>
            )}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="bg-emerald-100 p-3 rounded-xl">
              <DollarSign className="text-emerald-600 w-6 h-6" />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${currentRate >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
              {currentRate.toFixed(2)}% a.m.
            </span>
          </div>
          <p className="text-sm text-gray-500 font-medium">Saldo Atual</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-1">
            {stats.currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h3>
          <div className="mt-4 flex items-center gap-1 text-xs text-gray-400">
            <Info className="w-3 h-3" />
            <span>Mostra os tokens ativos já creditados</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="bg-blue-100 p-3 rounded-xl">
              <ArrowUpRight className="text-blue-600 w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-500 font-medium">Próximo Rendimento</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-1">
            {stats.periodProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h3>
          <p className="mt-4 text-xs text-blue-600 font-medium">
            Estimativa para a próxima competência
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="bg-purple-100 p-3 rounded-xl">
              <TrendingUp className="text-purple-600 w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-500 font-medium">
            {client.paymentFrequency === 'weekly' ? 'Previsão para Próxima Semana' :
             client.paymentFrequency === 'biweekly' ? 'Previsão para Próxima Quinzena' :
             'Previsão para Próximo Mês'}
          </p>
          <h3 className="text-3xl font-bold text-emerald-600 mt-1">
            {stats.projectedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h3>
          <div className="mt-4">
            {hasRate ? (
              <p className="text-xs text-gray-400 font-medium">
                Rendimento estimado: <span className="text-emerald-600">+{stats.periodProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </p>
            ) : (
              <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Taxa não configurada pelo gestor
              </p>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Projeção de Crescimento</h3>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              <span>Saldo Estimado</span>
            </div>
          </div>
          <div className="h-72 w-full">
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
                  formatter={(value: number, _name: string, props: any) => [
                    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                    props.payload.isProjection ? 'Saldo Previsto' : 'Saldo Real',
                  ]}
                />
                <ReferenceLine x={chartData[6].name} stroke="#9ca3af" strokeDasharray="3 3" label={{ value: 'Hoje', position: 'top', fill: '#9ca3af', fontSize: 10 }} />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorBalance)"
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" />
              Últimas Atividades
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[400px]">
            {[
              ...deposits.filter((deposit) => deposit.type !== 'reinvestment').map((deposit) => ({ ...deposit, activityType: 'deposit' as const })),
              ...payments.filter((payment) => payment.type !== 'reinvestment').map((payment) => ({ ...payment, activityType: 'payment' as const })),
              ...payments.filter((payment) => payment.type === 'reinvestment').map((payment) => ({ ...payment, activityType: 'reinvestment' as const })),
            ]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        item.activityType === 'deposit' ? 'bg-emerald-100 p-2 rounded-lg' :
                        item.activityType === 'reinvestment' ? 'bg-purple-100 p-2 rounded-lg' :
                        'bg-blue-100 p-2 rounded-lg'
                      }
                    >
                      {item.activityType === 'deposit' ? (
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                      ) : item.activityType === 'reinvestment' ? (
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {item.activityType === 'deposit' ? 'Tokens Adicionados' :
                         item.activityType === 'reinvestment' ? 'Rendimento Reaplicado' :
                         'Retirada Realizada'}
                      </p>
                      <p className="text-xs text-gray-500">{new Date(item.date).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-bold ${
                      item.activityType === 'deposit' ? 'text-emerald-600' :
                      item.activityType === 'reinvestment' ? 'text-purple-600' :
                      'text-blue-600'
                    }`}
                  >
                    {item.activityType === 'deposit' || item.activityType === 'reinvestment' ? '+' : '-'} {item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              ))}
            {deposits.length === 0 && payments.length === 0 && (
              <p className="text-center text-gray-400 text-sm italic py-8">Nenhuma atividade registrada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
