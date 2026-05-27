import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Deposit, Payment, PaymentFrequency } from '../types';
import { getClientStats } from '../utils/calculations';
import { 
  Plus, 
  Users, 
  ChevronRight, 
  Search, 
  TrendingUp, 
  DollarSign, 
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ManagerDashboardProps {
  manager: UserProfile;
  onSelectClient: (clientId: string) => void;
}

export default function ManagerDashboard({ manager, onSelectClient }: ManagerDashboardProps) {
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [allDeposits, setAllDeposits] = useState<Deposit[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientRate, setNewClientRate] = useState(1.5);
  const [newClientPayDay, setNewClientPayDay] = useState(10);
  const [newClientFrequency, setNewClientFrequency] = useState<PaymentFrequency>('monthly');

  const [payerEmail, setPayerEmail] = useState(manager.payerEmail || '');
  const [globalRate, setGlobalRate] = useState(manager.globalInterestRate || 0);
  const [isUpdatingPayer, setIsUpdatingPayer] = useState(false);
  const [isUpdatingGlobalRate, setIsUpdatingGlobalRate] = useState(false);

  useEffect(() => {
    const qClients = query(
      collection(db, 'users'), 
      where('role', '==', 'client'),
      where('managerId', '==', manager.uid)
    );
    const unsubClients = onSnapshot(qClients, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
    });

    const qDeposits = query(collection(db, 'deposits'), where('managerId', '==', manager.uid));
    const unsubDeposits = onSnapshot(qDeposits, (snapshot) => {
      setAllDeposits(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Deposit)));
    });

    const qPayments = query(collection(db, 'payments'), where('managerId', '==', manager.uid));
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      setAllPayments(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment)));
    });

    return () => {
      unsubClients();
      unsubDeposits();
      unsubPayments();
    };
  }, [manager.uid]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const normalizedEmail = newClientEmail.trim().toLowerCase();
      
      console.log('PASSO 1: Buscando usuário com email:', normalizedEmail);
      const q = query(collection(db, 'users'), where('email', '==', normalizedEmail));
      const querySnapshot = await getDocs(q);
      console.log('PASSO 1 OK: encontrados', querySnapshot.size, 'usuários');

      if (querySnapshot.empty) {
        setError('Este cliente ainda não se cadastrou no sistema com este e-mail. Peça para ele criar uma conta primeiro.');
        setIsSubmitting(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data() as UserProfile;
      console.log('PASSO 2: Dados do usuário encontrado:', userData.role, '| managerId:', userData.managerId);

      if (userData.managerId) {
        setError('Este cliente já possui um gestor associado.');
        setIsSubmitting(false);
        return;
      }

      console.log('PASSO 3: Tentando updateDoc no uid:', userDoc.id);
      await updateDoc(doc(db, 'users', userDoc.id), {
        managerId: manager.uid,
        interestRate: newClientRate,
        paymentDay: newClientPayDay,
        paymentFrequency: newClientFrequency,
      });
      console.log('PASSO 3 OK: cliente vinculado com sucesso');

      setIsModalOpen(false);
      setNewClientEmail('');
      setError(null);
    } catch (err) {
      console.error('ERRO DETALHADO:', err);
      setError('Ocorreu um erro ao tentar adicionar o cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePayer = async () => {
    setIsUpdatingPayer(true);
    try {
      await updateDoc(doc(db, 'users', manager.uid), {
        payerEmail: payerEmail.trim().toLowerCase()
      });
      alert('E-mail do pagador atualizado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar e-mail do pagador.');
    } finally {
      setIsUpdatingPayer(false);
    }
  };

  const handleUpdateGlobalRate = async () => {
    setIsUpdatingGlobalRate(true);
    try {
      await updateDoc(doc(db, 'users', manager.uid), {
        globalInterestRate: globalRate
      });
      alert('Taxa global semanal do pagador atualizada com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar taxa global.');
    } finally {
      setIsUpdatingGlobalRate(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (window.confirm('Tem certeza que deseja remover este cliente?')) {
      await deleteDoc(doc(db, 'users', clientId));
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPortfolio = filteredClients.reduce((sum, client) => {
    const stats = getClientStats(
      client, 
      allDeposits.filter(d => d.clientEmail.toLowerCase() === client.email.toLowerCase()),
      allPayments.filter(p => p.clientEmail.toLowerCase() === client.email.toLowerCase())
    );
    return sum + stats.currentBalance;
  }, 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-xl">
              <DollarSign className="text-blue-600 w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Tokens sob Gestão</p>
              <h3 className="text-2xl font-bold text-gray-900">
                {totalPortfolio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-3 rounded-xl">
              <TrendingUp className="text-purple-600 w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Rendimento Médio</p>
              <h3 className="text-2xl font-bold text-gray-900">
                {(clients.reduce((sum, c) => sum + (c.interestRate || 0), 0) / (clients.length || 1)).toFixed(2)}%
              </h3>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-gray-900">Lista de Clientes</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Novo Cliente
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Total Tokens</th>
                <th className="px-6 py-4 font-semibold">Saldo Atual</th>
                <th className="px-6 py-4 font-semibold">Taxa</th>
                <th className="px-6 py-4 font-semibold">Próx. Pagamento</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredClients.map((client) => {
                const stats = getClientStats(
                  client,
                  allDeposits.filter(d => d.clientId === client.uid),
                  allPayments.filter(p => p.clientId === client.uid)
                );
                return (
                  <tr key={client.uid} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{client.name}</span>
                        <span className="text-xs text-gray-500">{client.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {stats.totalInvested.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-emerald-600">
                      {stats.currentBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex flex-col">
                        <span>{client.interestRate}%</span>
                        <span className="text-[10px] text-gray-400 uppercase">
                          {client.paymentFrequency === 'weekly' ? 'Semanal' : client.paymentFrequency === 'biweekly' ? 'Quinzenal' : 'Mensal'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`text-sm font-medium ${stats.isOverdue ? 'text-red-600' : stats.isPaid ? 'text-emerald-600' : stats.isWarning ? 'text-orange-500' : 'text-gray-900'}`}>
                          {stats.nextPaymentDate.toLocaleDateString('pt-BR')}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
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
                            <span className="text-[10px] text-gray-400 uppercase">
                              {stats.daysRemaining} dias
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onSelectClient(client.uid)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Gerenciar"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.uid)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-50 p-2 rounded-lg">
              <Users className="text-blue-600 w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Configuração do Pagador</h3>
              <p className="text-xs text-gray-500">Vincule um pagador para acesso aos dados</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="E-mail do pagador"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={handleUpdatePayer}
              disabled={isUpdatingPayer}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center min-w-[140px]"
            >
              {isUpdatingPayer ? 'Salvando...' : 'Vincular Pagador'}
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-50 p-2 rounded-lg">
              <TrendingUp className="text-purple-600 w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Taxa Global do Pagador</h3>
              <p className="text-xs text-gray-500">Esta taxa sobrepõe as individuais na tela do pagador</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Taxa Global Semanal (%)"
                  value={globalRate}
                  onChange={(e) => setGlobalRate(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
              <div className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 font-medium flex items-center justify-center min-w-[120px]">
                Semanal
              </div>
            </div>
            <button
              onClick={handleUpdateGlobalRate}
              disabled={isUpdatingGlobalRate}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center"
            >
              {isUpdatingGlobalRate ? 'Salvando...' : 'Definir Taxa Global'}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Novo Cliente</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleCreateClient} className="p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail do Cliente</label>
                  <input
                    type="email"
                    required
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="email@cliente.com"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    O cliente deve estar previamente cadastrado no sistema.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {newClientFrequency === 'weekly' ? 'Taxa Semanal (%)' : 
                       newClientFrequency === 'biweekly' ? 'Taxa Quinzenal (%)' : 
                       'Taxa Mensal (%)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newClientRate}
                      onChange={(e) => setNewClientRate(parseFloat(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequência</label>
                    <select
                      value={newClientFrequency}
                      onChange={(e) => setNewClientFrequency(e.target.value as PaymentFrequency)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="monthly">Mensal</option>
                      <option value="biweekly">Quinzenal</option>
                      <option value="weekly">Semanal</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {newClientFrequency === 'monthly' ? 'Dia do Mês' : newClientFrequency === 'weekly' ? 'Dia da Semana (1-7)' : 'Dia de Início (Automático)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={newClientFrequency === 'monthly' ? 31 : 7}
                    required
                    value={newClientPayDay}
                    onChange={(e) => setNewClientPayDay(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    disabled={newClientFrequency === 'biweekly'}
                  />
                  {newClientFrequency === 'weekly' && (
                    <p className="text-[10px] text-gray-400 mt-1">1=Seg, 2=Ter, ..., 7=Dom</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-100 mt-4 flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    'Vincular Cliente'
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}