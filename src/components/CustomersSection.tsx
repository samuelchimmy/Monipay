import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoniPayLogo } from './MoniPayLogo';
import { 
  ArrowLeft, Users, Search, Plus, RefreshCw, 
  User, Mail, Phone, FileText, Tag, DollarSign,
  ShoppingBag, Clock, Trash2, Edit2, X, Check,
  TrendingUp, Repeat, ChevronRight
} from 'lucide-react';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { shortenAddress } from '@/lib/wallet';
import { format } from 'date-fns';
import { feedback } from '@/lib/feedback';

interface CustomersSectionProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string | undefined;
  embedded?: boolean;
}

export function CustomersSection({ isOpen, onClose, profileId, embedded = false }: CustomersSectionProps) {
  const { 
    customers, 
    stats, 
    isLoading, 
    isSyncing,
    syncFromTransactions,
    updateCustomer,
    deleteCustomer,
    addCustomer,
  } = useCustomers(profileId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [newCustomerForm, setNewCustomerForm] = useState({
    payTag: '',
    name: '',
    email: '',
    phone: '',
    notes: '',
  });

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.pay_tag?.toLowerCase().includes(query) ||
      c.wallet_address?.toLowerCase().includes(query) ||
      c.name?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.phone?.includes(query)
    );
  }, [customers, searchQuery]);

  const handleSync = async () => {
    feedback('tap');
    await syncFromTransactions();
    feedback('success');
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      notes: customer.notes || '',
    });
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedCustomer) return;
    feedback('tap');
    const updated = await updateCustomer(selectedCustomer.id, editForm);
    if (updated) {
      setSelectedCustomer(updated);
      setIsEditing(false);
      feedback('success');
    }
  };

  const handleDelete = async () => {
    if (!selectedCustomer) return;
    feedback('tap');
    const success = await deleteCustomer(selectedCustomer.id);
    if (success) {
      setSelectedCustomer(null);
      feedback('success');
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomerForm.payTag.trim()) return;
    feedback('tap');
    const customer = await addCustomer({
      pay_tag: newCustomerForm.payTag.replace('@', ''),
      name: newCustomerForm.name || null,
      email: newCustomerForm.email || null,
      phone: newCustomerForm.phone || null,
      notes: newCustomerForm.notes || null,
    });
    if (customer) {
      setShowAddModal(false);
      setNewCustomerForm({ payTag: '', name: '', email: '', phone: '', notes: '' });
      feedback('success');
    }
  };

  // Helper: Render customer detail panel
  const renderCustomerDetail = () => (
    <div className="flex-1 overflow-y-auto">
      {/* Detail Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-lg border-b border-border p-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedCustomer(null)}
          className="lg:hidden rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-bold text-foreground">
            {selectedCustomer?.name || selectedCustomer?.pay_tag 
              ? `@${selectedCustomer?.pay_tag}` 
              : shortenAddress(selectedCustomer?.wallet_address || '')
            }
          </h2>
          {selectedCustomer?.name && selectedCustomer?.pay_tag && (
            <p className="text-xs text-muted-foreground">@{selectedCustomer.pay_tag}</p>
          )}
        </div>
        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
            >
              <X className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              className="gap-1.5 bg-success hover:bg-success/90"
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <DollarSign className="w-5 h-5 mx-auto text-success mb-1" />
            <p className="text-lg font-bold text-foreground">${selectedCustomer?.total_spent.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total Spent</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <ShoppingBag className="w-5 h-5 mx-auto text-base-blue mb-1" />
            <p className="text-lg font-bold text-foreground">{selectedCustomer?.total_orders}</p>
            <p className="text-xs text-muted-foreground">Orders</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Clock className="w-5 h-5 mx-auto text-amber-500 mb-1" />
            <p className="text-lg font-bold text-foreground">
              {selectedCustomer?.last_purchase_at 
                ? format(new Date(selectedCustomer.last_purchase_at), 'MMM d')
                : '-'
              }
            </p>
            <p className="text-xs text-muted-foreground">Last Purchase</p>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          <div className="p-4">
            <label className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
              <User className="w-3.5 h-3.5" />
              Name
            </label>
            {isEditing ? (
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Customer name"
              />
            ) : (
              <p className="text-foreground font-medium">
                {selectedCustomer?.name || <span className="text-muted-foreground">Not set</span>}
              </p>
            )}
          </div>
          <div className="p-4">
            <label className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
              <Mail className="w-3.5 h-3.5" />
              Email
            </label>
            {isEditing ? (
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="customer@email.com"
              />
            ) : (
              <p className="text-foreground font-medium">
                {selectedCustomer?.email || <span className="text-muted-foreground">Not set</span>}
              </p>
            )}
          </div>
          <div className="p-4">
            <label className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
              <Phone className="w-3.5 h-3.5" />
              Phone
            </label>
            {isEditing ? (
              <Input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="+1 234 567 8900"
              />
            ) : (
              <p className="text-foreground font-medium">
                {selectedCustomer?.phone || <span className="text-muted-foreground">Not set</span>}
              </p>
            )}
          </div>
          <div className="p-4">
            <label className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5" />
              Notes
            </label>
            {isEditing ? (
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Add notes about this customer..."
                className="w-full min-h-[80px] bg-background border border-input rounded-md px-3 py-2 text-sm resize-none"
              />
            ) : (
              <p className="text-foreground text-sm whitespace-pre-wrap">
                {selectedCustomer?.notes || <span className="text-muted-foreground">No notes</span>}
              </p>
            )}
          </div>
        </div>

        {/* Wallet Info */}
        {selectedCustomer?.wallet_address && (
          <div className="bg-card border border-border rounded-xl p-4">
            <label className="text-xs text-muted-foreground mb-2 block">Wallet Address</label>
            <p className="text-foreground font-mono text-sm break-all">
              {selectedCustomer.wallet_address}
            </p>
          </div>
        )}

        {/* Delete Button */}
        <Button
          variant="outline"
          onClick={handleDelete}
          className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Customer
        </Button>
      </div>
    </div>
  );

  // Helper: Render add customer modal
  const renderAddModal = () => (
    <AnimatePresence>
      {showAddModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground">Add Customer</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAddModal(false)}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">PayTag *</label>
                <Input
                  value={newCustomerForm.payTag}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, payTag: e.target.value })}
                  placeholder="@username"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Name</label>
                <Input
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  placeholder="Customer name"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                <Input
                  type="email"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  placeholder="customer@email.com"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Phone</label>
                <Input
                  type="tel"
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Notes</label>
                <textarea
                  value={newCustomerForm.notes}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                  placeholder="Optional notes..."
                  className="w-full min-h-[60px] bg-background border border-input rounded-md px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-border">
              <Button
                onClick={handleAddCustomer}
                disabled={!newCustomerForm.payTag.trim()}
                className="w-full bg-base-blue hover:bg-base-blue/90"
              >
                Add Customer
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!isOpen) return null;

  // When embedded, render without the fixed container and header
  if (embedded) {
    return (
      <div className="h-full overflow-hidden">
        <div className="flex h-full">
          {/* Customer List */}
          <div className={`${selectedCustomer ? 'hidden lg:block lg:w-[360px]' : 'w-full'} border-r border-border overflow-y-auto`}>
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 gap-2 p-4 border-b border-border">
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-base-blue" />
                    <span className="text-xs text-muted-foreground">Total</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{stats.totalCustomers}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Repeat className="w-4 h-4 text-success" />
                    <span className="text-xs text-muted-foreground">Repeat Rate</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{stats.repeatRate.toFixed(0)}%</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-muted-foreground">Revenue</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">${stats.totalRevenue.toFixed(0)}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                    <span className="text-xs text-muted-foreground">Avg Order</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">${stats.avgOrderValue.toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Search + Actions */}
            <div className="p-4 border-b border-border">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search customers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  size="icon"
                  onClick={() => setShowAddModal(true)}
                  className="bg-base-blue hover:bg-base-blue/90"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Customer List */}
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <MoniPayLogo size={28} color="hsl(var(--muted-foreground))" animationMode="processing" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center p-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="flex justify-center mb-3"
                >
                  <MoniPayLogo size={48} color="hsl(var(--muted-foreground))" animationMode="idle" isEmpty />
                </motion.div>
                <p className="text-muted-foreground">
                  {customers.length === 0 
                    ? 'No customers yet. Sync from transactions to get started.'
                    : 'No customers found matching your search.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer)}
                    className="w-full p-4 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-base-blue/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-base-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {customer.name || customer.pay_tag || shortenAddress(customer.wallet_address || '')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {customer.total_orders} orders · ${customer.total_spent.toFixed(2)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer Detail (embedded version uses same structure as full version) */}
          {selectedCustomer && renderCustomerDetail()}
        </div>

        {/* Add Customer Modal */}
        {renderAddModal()}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-50 bg-background overflow-hidden"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Customers</h1>
            <p className="text-xs text-muted-foreground">{customers.length} contacts</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="gap-1.5 bg-base-blue hover:bg-base-blue/90"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Customer List */}
        <div className={`${selectedCustomer ? 'hidden lg:block lg:w-[360px]' : 'w-full'} border-r border-border overflow-y-auto`}>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 gap-2 p-4 border-b border-border">
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-base-blue" />
                  <span className="text-xs text-muted-foreground">Total</span>
                </div>
                <p className="text-xl font-bold text-foreground">{stats.totalCustomers}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Repeat className="w-4 h-4 text-success" />
                  <span className="text-xs text-muted-foreground">Repeat</span>
                </div>
                <p className="text-xl font-bold text-foreground">{stats.repeatRate.toFixed(0)}%</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-success" />
                  <span className="text-xs text-muted-foreground">Revenue</span>
                </div>
                <p className="text-xl font-bold text-foreground">${stats.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Avg Order</span>
                </div>
                <p className="text-xl font-bold text-foreground">${stats.avgOrderValue.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Customer List */}
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center">
                <MoniPayLogo size={28} color="hsl(var(--muted-foreground))" animationMode="processing" />
                <p className="text-sm text-muted-foreground mt-3">Loading customers...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8 text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="flex justify-center mb-3"
                >
                  <MoniPayLogo size={48} color="hsl(var(--muted-foreground))" animationMode="idle" isEmpty />
                </motion.div>
                <p className="text-sm text-muted-foreground">No customers found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {customers.length === 0 
                    ? 'Sync from transactions or add manually' 
                    : 'Try a different search term'
                  }
                </p>
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                    selectedCustomer?.id === customer.id ? 'bg-muted' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-base-blue/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-base-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-foreground truncate">
                          {customer.name || customer.pay_tag 
                            ? `@${customer.pay_tag}` 
                            : customer.wallet_address 
                              ? shortenAddress(customer.wallet_address) 
                              : 'Unknown'
                          }
                        </p>
                        {customer.wallet_address && !customer.pay_tag && (
                          <span className="px-1.5 py-0.5 text-[8px] font-semibold bg-muted text-muted-foreground rounded">
                            External
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {customer.total_orders} orders · ${customer.total_spent.toFixed(2)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Customer Detail */}
        {selectedCustomer && renderCustomerDetail()}
      </div>

      {/* Add Customer Modal */}
      {renderAddModal()}
    </motion.div>
  );
}
