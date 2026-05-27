import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Deposit, Payment, PaymentFrequency } from '../types';
import { getClientStats } from '../utils/calculations';
import { 
  Users, 
  Search, 
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';

interface PayerDashboardProps {
  payer: UserProfile;
}

export default function PayerDashboard({ payer }: PayerDashboardProps) {
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [allDeposits, setAllDeposits] = useState<Deposit[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [globalRate, setGlobalRate] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const qManagers = query(
      collection(db, 'users'), 
      where('role', '==', 'manager'),
      where('payerEmail', '==', payer.email.toLowerCase())
    );
    
    let unsubClients: (() => void) | null = null;
    let unsubDeposits: (() => void) | null = null;
    let unsubPayments: (() => void) | null = null;

    const unsubManagers = onSnapshot(qManagers, (mgrSnapshot) => {
      const managerIds = mgrSnapshot.docs.map(doc => doc.id);
      const managers = mgrSnapshot.docs.map(doc => doc.data() as UserProfile);
      
      // Se houver pelo menos um manager, pega a taxa global do primeiro (assumindo um manager principal)
      if (managers.length > 0 && typeof managers[0].globalInterestRate === 'number') {
        setGlobalRate(managers[0].globalInterestRate);
      } else {
        setGlobalRate(null);
      }
      
      if (unsubClients) unsubClients();
      if (unsubDeposits) unsubDeposits();
      if (unsubPayments) unsubPayments();

      if (managerIds.length === 0) {
        setClients([]);
        setAllDeposits([]);
        setAllPayments([]);
        return;
      }

      // Busca clientes pelo managerId
      const qClients = query(
        collection(db, 'users'), 
        where('role', '==', 'client'),
        where('managerId', 'in', managerIds)
      );
      unsubClients = onSnapshot(qClients, (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
      });

      // Busca depósitos pelo managerId (não pelo payerEmail)
      const qDeposits = query(
        collection(db, 'deposits'),
        where('managerId', 'in', managerIds)
      );
      unsubDeposits = onSnapshot(qDeposits, (snapshot) => {
        setAllDeposits(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Deposit)));
      });

      // Busca pagamentos pelo managerId (não pelo payerEmail)
      const qPayments = query(
        collection(db, 'payments'),
        where('managerId', 'in', managerIds)
      );
      unsubPayments = onSnapshot(qPayments, (snapshot) => {
        setAllPayments(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment)));
      });
    });

    return () => {
      unsubManagers();
      if (unsubClients) unsubClients();
      if (unsubDeposits) unsubDeposits();
      if (unsubPayments) unsubPayments();
    };
  }, [payer.email]);

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalToPay = clients.reduce((sum, client) => {
    const stats = getClientStats(
      client,
      allDeposits.filter(d => d.clientId === client.uid),
      allPayments.filter(p => p.clientId === client.uid),
      globalRate ?? undefined,
      'weekly' // SEMPRE semanal para o pagador
    );
    return sum + stats.periodProfit;
  }, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Painel do Pagador</h1>
          <p className="text-gray-500 mt-1">Controle de pagamentos e repasses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-xl">
              <Users className="text-emerald-600 w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total de Clientes</p>
              <h3 className="text-2xl font-bold text-gray-900">{clients.length}</h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-xl">
              <DollarSign className="text-blue-600 w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Capital Total sob Gestão</p>
              <h3 className="text-2xl font-bold text-gray-900">
                {clients.reduce((sum, client) => {
                  const stats = getClientStats(
                    client,
                    allDeposits.filter(d => d.clientId === client.uid),
                    allPayments.filter(p => p.clientId === client.uid),
                    globalRate ?? undefined
                  );
                  return sum + stats.currentBalance;
                }, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-xl">
              <Clock className="text-purple-600 w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500 font-medium">Próximos Repasses (Total)</p>
                {globalRate !== null && (
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                    Taxa Global: {globalRate}% Semanal
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-bold text-purple-600">
                {totalToPay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900">Lista de Pagamentos</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Capital (Saldo)</th>
                <th className="px-6 py-4 font-semibold">Valor do Repasse</th>
                <th className="px-6 py-4 font-semibold">Dia de Recebimento</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredClients.map((client) => {
                const stats = getClientStats(
                  client,
                  allDeposits.filter(d => d.clientId === client.uid),
                  allPayments.filter(p => p.clientId === client.uid),
                  globalRate ?? undefined,
                  'weekly'
                );

                return (
                  <tr key={client.uid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {stats.currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-purple-600">
                      <div className="flex flex-col">
                        <span>{stats.periodProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        {globalRate !== null && (
                          <span className="text-[10px] text-purple-400">
                            ({globalRate}% semanal)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900 font-medium">
                          {stats.nextPaymentDate.toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-[10px] text-gray-400 uppercase">
                          Semanal
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {stats.isPaid ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" />
                          Pago
                        </div>
                      ) : stats.isOverdue ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider animate-pulse">
                          <AlertCircle className="w-3 h-3" />
                          Vencido
                        </div>
                      ) : stats.isWarning ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider">
                          <Clock className="w-3 h-3" />
                          Próximo
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
                          <Clock className="w-3 h-3" />
                          Aguardando
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}