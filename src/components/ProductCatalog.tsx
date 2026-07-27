import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, Plus, Package, Trash2, Edit2, X, Check, 
  Image as ImageIcon, DollarSign, Tag, Grid3X3, List, Loader2, Pin, PinOff,
  Link as LinkIcon, Globe, Crown, Clock, Copy, AlertCircle, Store as StoreIcon, PackageX
} from 'lucide-react';

import { usePayTag } from '@/contexts/PayTagContext';
import { useSecurityGate } from './SecurityGate';
import { PaymentLinkModal } from './PaymentLinkModal';
import { toast } from '@/components/ui/use-toast';
import { feedback } from '@/lib/feedback';
import { signedFetch } from '@/lib/signedFetch';
import { getChainConfig, type SupportedNetwork } from '@/config/chains';
import { signPaymentAuthorization, getPaymentNonce, checkUsdcApproval } from '@/lib/wallet';

export interface Product {
  id: string;
  name: string;
  price: number;
  icon: string;
  category: string;
  imageUrl?: string;
  description?: string;
  pinned?: boolean;
  sortOrder?: number;
  visibleOnStorefront?: boolean;
  stockQuantity?: number | null; // null = unlimited, 0 = out of stock
}

const SUPABASE_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co';

const MAX_PINNED_PRODUCTS = 4;

interface ProductCatalogProps {
  products: Product[];
  onProductsChange: (products: Product[]) => void;
  onClose: () => void;
  /**
   * When true, skips the PIN/biometric SecurityGate for add/edit/delete.
   * Use this for wallet-only contexts (MiniPay) where the user has no
   * MoniPay PIN — the wallet session itself is the authorization.
   */
  bypassSecurity?: boolean;
}

const CATEGORIES = ['Food', 'Drinks', 'Services', 'Retail', 'Other'];
const ICONS = ['coffee', 'shopping', 'utensils', 'sparkles', 'package'];
const SUPABASE_FUNCTIONS_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1';
const MONIBOT_PAY_TAG = 'monibot';
const SUBSCRIPTION_AMOUNT = 30;

export function ProductCatalog({ products, onProductsChange, onClose, bypassSecurity = false }: ProductCatalogProps) {
  const { profile, decryptedPrivateKey, lookupPayTag } = usePayTag();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProductForLink, setSelectedProductForLink] = useState<Product | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    active: boolean;
    gracePeriod?: boolean;
    expiresAt?: string;
    plan?: string;
  } | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribeStep, setSubscribeStep] = useState<'paying' | 'activating' | 'done' | 'error' | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Security gate for adding products
  const { requestAccess, SecurityGateModal } = useSecurityGate();
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategory, setFormCategory] = useState('Other');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('package');

  // Fetch subscription status (admin @monibot gets free access)
  useEffect(() => {
    if (!profile?.id) return;
    if (profile.payTag === 'monibot') {
      setSubscriptionStatus({ active: true, plan: 'admin' });
      setIsLoadingSubscription(false);
      return;
    }
    setIsLoadingSubscription(true);
    fetch(`${SUPABASE_FUNCTIONS_URL}/merchant-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkStatus', profileId: profile.id }),
    })
      .then(res => res.json())
      .then(data => setSubscriptionStatus(data))
      .catch(() => setSubscriptionStatus({ active: false }))
      .finally(() => setIsLoadingSubscription(false));
  }, [profile?.id, profile?.payTag]);

  // Countdown helper
  const getTimeRemaining = () => {
    if (!subscriptionStatus?.expiresAt) return null;
    const now = new Date().getTime();
    const exp = new Date(subscriptionStatus.expiresAt).getTime();
    const diff = exp - now;
    if (diff <= 0) return { days: 0, hours: 0, expired: true };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return { days, hours, expired: false };
  };

  const handleSubscribe = async () => {
    if (!profile?.id || !profile?.wallet?.address || !decryptedPrivateKey) {
      setSubscribeStep('error');
      setSubscribeError('Please unlock your wallet first (go back to dashboard and enter PIN).');
      return;
    }
    setIsSubscribing(true);
    setSubscribeStep('paying');
    try {
      const network = (profile.preferredNetwork || 'celo') as SupportedNetwork;
      const config = getChainConfig(network);

      // Lookup monibot's wallet address
      const recipient = await lookupPayTag(MONIBOT_PAY_TAG);
      if (!recipient?.walletAddress) {
        throw new Error('Could not resolve @monibot address');
      }

      // Calculate fee (1%)
      const fee = SUBSCRIPTION_AMOUNT * 0.01;
      const totalWithFee = SUBSCRIPTION_AMOUNT + fee;

      // Check approval
      const approvalStatus = await checkUsdcApproval(profile.wallet.address, network);
      const requiredAmount = BigInt(Math.ceil(totalWithFee * Math.pow(10, config.decimals)));
      if (approvalStatus.allowance < requiredAmount) {
        throw new Error(`Insufficient ${config.token} allowance. Please activate your wallet first.`);
      }

      // Get nonce
      const nonce = await getPaymentNonce(profile.wallet.address, network);

      // Sign payment authorization (EIP-712 for Base/BSC, dummy for Tempo)
      const { signature, message } = await signPaymentAuthorization(
        decryptedPrivateKey,
        recipient.walletAddress as `0x${string}`,
        SUBSCRIPTION_AMOUNT,
        fee,
        nonce,
        network
      );

      // Relay payment
      const relayRes = await fetch(`${SUPABASE_FUNCTIONS_URL}/relay-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'relay',
          signature,
          message: {
            from: profile.wallet.address,
            to: recipient.walletAddress,
            amount: message.amount.toString(),
            fee: message.fee.toString(),
            nonce: message.nonce.toString(),
            deadline: message.deadline.toString(),
          },
          senderProfileId: profile.id,
          recipientPayTag: MONIBOT_PAY_TAG,
          network,
        }),
      });

      const relayData = await relayRes.json();
      if (!relayRes.ok || !relayData.txHash) {
        throw new Error(relayData.error || 'Payment failed — check your balance');
      }

      setSubscribeStep('activating');

      const subRes = await signedFetch(`${SUPABASE_FUNCTIONS_URL}/merchant-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe',
          profileId: profile.id,
          txHash: relayData.txHash,
        }),
      });

      const subData = await subRes.json();
      if (!subRes.ok) {
        throw new Error(subData.error || 'Subscription activation failed');
      }

      setSubscribeStep('done');
      feedback('success');
      
      setTimeout(() => {
        setSubscriptionStatus({
          active: true,
          expiresAt: subData.subscription.expiresAt,
          plan: subData.subscription.plan,
        });
        setShowSubscriptionModal(false);
        setSubscribeStep(null);
        toast({ title: '🎉 Pro Store Activated!', description: 'Your public storefront is now live.' });
      }, 2000);
    } catch (err: any) {
      console.error('Subscribe error:', err);
      setSubscribeStep('error');
      setSubscribeError(err.message || 'Something went wrong. Please try again.');
      feedback('error');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSecureAddProduct = () => {
    if (bypassSecurity) { setShowAddProduct(true); return; }
    requestAccess({
      title: 'Add Product',
      description: 'Enter PIN or use biometrics to add products',
      onSuccess: () => setShowAddProduct(true),
    });
  };

  const handleSecureEditProduct = (product: Product) => {
    if (bypassSecurity) { handleEditProduct(product); return; }
    requestAccess({
      title: 'Edit Product',
      description: 'Enter PIN or use biometrics to edit products',
      onSuccess: () => handleEditProduct(product),
    });
  };

  const handleSecureDeleteProduct = (product: Product) => {
    if (bypassSecurity) { handleDeleteProduct(product.id); return; }
    requestAccess({
      title: 'Delete Product',
      description: 'Enter PIN or use biometrics to delete products',
      onSuccess: () => handleDeleteProduct(product.id),
    });
  };

  const pinnedCount = products.filter(p => p.pinned).length;

  const handleTogglePin = async (product: Product) => {
    // Check if we're trying to pin and already at max
    if (!product.pinned && pinnedCount >= MAX_PINNED_PRODUCTS) {
      return;
    }

    try {
      const newSortOrder = !product.pinned ? pinnedCount : 0;
      
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'togglePin',
          productId: product.id,
          profileId: profile?.id,
          pinned: !product.pinned,
          sortOrder: newSortOrder,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update');
      }

      const updatedProducts = products.map(p => 
        p.id === product.id ? { ...p, pinned: !p.pinned, sortOrder: newSortOrder } : p
      );
      onProductsChange(updatedProducts);
    } catch (error) {
      console.error('Toggle pin error:', error);
    }
  };

  const handleToggleStorefront = async (product: Product) => {
    const newVisibility = !product.visibleOnStorefront;
    try {
      const response = await signedFetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggleStorefront',
          productId: product.id,
          profileId: profile?.id,
          visibleOnStorefront: newVisibility,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update');
      }

      const updatedProducts = products.map(p => 
        p.id === product.id ? { ...p, visibleOnStorefront: newVisibility } : p
      );
      onProductsChange(updatedProducts);
      toast({
        title: newVisibility ? 'Added to Storefront' : 'Removed from Storefront',
        description: `${product.name} is now ${newVisibility ? 'visible' : 'hidden'} on your public store.`,
      });
      feedback('success');
    } catch (error) {
      console.error('Toggle storefront error:', error);
      toast({ title: 'Error', description: 'Failed to update storefront visibility.', variant: 'destructive' });
    }
  };

  const handleToggleStock = async (product: Product) => {
    const newStock = product.stockQuantity === 0 ? null : 0; // toggle between out-of-stock and unlimited
    try {
      const response = await signedFetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateStock',
          productId: product.id,
          profileId: profile?.id,
          stockQuantity: newStock,
        }),
      });
      if (!response.ok) throw new Error('Failed to update stock');
      const updatedProducts = products.map(p =>
        p.id === product.id ? { ...p, stockQuantity: newStock } : p
      );
      onProductsChange(updatedProducts);
      toast({
        title: newStock === 0 ? 'Marked Out of Stock' : 'Back in Stock',
        description: `${product.name} is now ${newStock === 0 ? 'unavailable' : 'available'} to customers.`,
      });
      feedback('success');
    } catch (error) {
      console.error('Toggle stock error:', error);
      toast({ title: 'Error', description: 'Failed to update stock status.', variant: 'destructive' });
    }
  };

  const filteredProducts = products
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      // Sort pinned products first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

  const resetForm = () => {
    setFormName('');
    setFormPrice('');
    setFormCategory('Other');
    setFormDescription('');
    setFormIcon('package');
    setEditingProduct(null);
    setShowAddProduct(false);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormPrice(product.price.toString());
    setFormCategory(product.category || 'Other');
    setFormDescription(product.description || '');
    setFormIcon(product.icon);
    setImagePreview(product.imageUrl || null);
    setImageFile(null);
    setShowAddProduct(true);
  };

  const uploadProductImage = async (file: File, productId: string): Promise<string | null> => {
    try {
      setIsUploadingImage(true);
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `product-images/${profile?.id}/${productId}.${ext}`;
      
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/monipay/${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      });

      if (!res.ok) {
        // Try upsert if file exists
        const res2 = await fetch(`${SUPABASE_URL}/storage/v1/object/monipay/${path}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        });
        if (!res2.ok) throw new Error('Upload failed');
      }

      return `${SUPABASE_URL}/storage/v1/object/public/monipay/${path}?t=${Date.now()}`;
    } catch (err) {
      console.error('Image upload error:', err);
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSaveProduct = async () => {
    if (!formName.trim()) {
      return;
    }
    
    const price = parseFloat(formPrice);
    if (isNaN(price) || price <= 0) {
      return;
    }

    setIsSaving(true);

    const productData: any = {
      name: formName.trim(),
      price,
      category: formCategory,
      description: formDescription.trim(),
      icon: formIcon,
    };

    try {
      if (editingProduct) {
        // Upload image if changed
        if (imageFile) {
          const url = await uploadProductImage(imageFile, editingProduct.id);
          if (url) productData.imageUrl = url;
        }

        const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            productId: editingProduct.id,
            profileId: profile?.id,
            product: productData,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to update');
        }
        const updatedProducts = products.map(p => 
          p.id === editingProduct.id ? { ...p, ...productData } : p
        );
        onProductsChange(updatedProducts);
      } else {
        // Create new product in Supabase
        if (!profile?.id) {
          setIsSaving(false);
          return;
        }

        const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            profileId: profile.id,
            product: productData,
          }),
        });

        if (!response.ok) throw new Error('Failed to create');

        const data = await response.json();

        // Upload image after creation (need product ID)
        if (imageFile && data.product?.id) {
          const url = await uploadProductImage(imageFile, data.product.id);
          if (url) {
            productData.imageUrl = url;
            // Update product with image URL
            await fetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'update',
                productId: data.product.id,
                profileId: profile.id,
                product: { ...productData, imageUrl: url },
              }),
            });
          }
        }

        const newProduct: Product = {
          id: data.product.id,
          ...productData,
        };
        onProductsChange([...products, newProduct]);
      }
      
      resetForm();
    } catch (error) {
      console.error('Save product error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'delete', 
          productId: id,
          profileId: profile?.id 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete');
      }

      onProductsChange(products.filter(p => p.id !== id));
    } catch (error) {
      console.error('Delete product error:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-50 bg-background overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Store</h1>
          
          {/* Share Store */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const url = `https://monipay.xyz/store/@${profile?.payTag}`;
              navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
              toast({ title: 'Store URL Copied!', description: url });
              feedback('copy');
            }}
            className="rounded-full"
          >
            {copied ? <Check className="w-5 h-5 text-success" /> : <Globe className="w-5 h-5" />}
          </Button>

          {/* Pro badge / Subscribe */}
          <Button
            variant={subscriptionStatus?.active ? 'ghost' : 'default'}
            size="sm"
            onClick={() => setShowSubscriptionModal(true)}
            className={`rounded-full h-8 text-xs gap-1 ${
              subscriptionStatus?.active 
                ? 'text-amber-500 hover:text-amber-600' 
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            {subscriptionStatus?.active ? 'Pro' : 'Upgrade'}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="rounded-full"
          >
            {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid3X3 className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="container px-4 py-4 space-y-3">
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 rounded-xl"
        />
        
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className={`rounded-full whitespace-nowrap ${
              selectedCategory === null ? 'bg-base-blue hover:bg-base-blue/90' : ''
            }`}
          >
            All
          </Button>
          {CATEGORIES.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full whitespace-nowrap ${
                selectedCategory === cat ? 'bg-base-blue hover:bg-base-blue/90' : ''
              }`}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Product Grid/List */}
      <div className="flex-1 overflow-y-auto container px-4 pb-24">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No products found</p>
            <Button
              onClick={handleSecureAddProduct}
              className="mt-4 bg-base-blue hover:bg-base-blue/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Product
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map(product => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border rounded-xl p-4 relative group"
              >
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={() => handleToggleStorefront(product)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      product.visibleOnStorefront !== false
                        ? 'bg-emerald-500/20 text-emerald-500' 
                        : 'bg-muted hover:bg-emerald-500/10 text-muted-foreground'
                    }`}
                    title={product.visibleOnStorefront !== false ? 'Remove from Storefront' : 'Add to Storefront'}
                  >
                    <StoreIcon className="w-4 h-4" />
                  </button>
                   <button
                    onClick={() => handleToggleStock(product)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      product.stockQuantity === 0
                        ? 'bg-destructive/20 text-destructive' 
                        : 'bg-muted hover:bg-destructive/10 text-muted-foreground'
                    }`}
                    title={product.stockQuantity === 0 ? 'Mark In Stock' : 'Mark Out of Stock'}
                  >
                    <PackageX className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedProductForLink(product)}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-green-500/10"
                    title="Create Payment Link"
                  >
                    <LinkIcon className="w-4 h-4 text-green-500" />
                  </button>
                  <button
                    onClick={() => handleTogglePin(product)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      product.pinned 
                        ? 'bg-base-blue/20 text-base-blue' 
                        : 'bg-muted hover:bg-base-blue/10 text-muted-foreground'
                    }`}
                    title={product.pinned ? 'Unpin from Quick Add' : 'Pin to Quick Add'}
                  >
                    {product.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleSecureEditProduct(product)}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-base-blue/10"
                  >
                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleSecureDeleteProduct(product)}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
                
                {/* Pinned / Storefront / Stock indicators */}
                <div className="absolute top-2 left-2 flex gap-1">
                  {product.pinned && <Pin className="w-4 h-4 text-base-blue" />}
                  {product.visibleOnStorefront !== false && <StoreIcon className="w-4 h-4 text-emerald-500" />}
                  {product.stockQuantity === 0 && <PackageX className="w-4 h-4 text-destructive" />}
                </div>
                
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded-xl object-cover mb-3" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-base-blue/10 flex items-center justify-center mb-3">
                    <Package className="w-6 h-6 text-base-blue" />
                  </div>
                )}
                
                <h3 className={`font-semibold truncate ${product.stockQuantity === 0 ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{product.name}</h3>
                <p className="text-xs text-muted-foreground mb-2">{product.category}</p>
                <p className="text-lg font-bold text-base-blue">${product.price.toFixed(2)}</p>
                {product.stockQuantity === 0 && (
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-wide mt-1">Out of Stock</p>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map(product => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-base-blue/10 flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 text-base-blue" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                  <p className="text-xs text-muted-foreground">{product.category}</p>
                </div>
                
                <p className="text-lg font-bold text-base-blue flex-shrink-0">${product.price.toFixed(2)}</p>
                
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleStorefront(product)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      product.visibleOnStorefront !== false
                        ? 'bg-emerald-500/20 text-emerald-500' 
                        : 'bg-muted hover:bg-emerald-500/10 text-muted-foreground'
                    }`}
                    title={product.visibleOnStorefront !== false ? 'Remove from Storefront' : 'Add to Storefront'}
                  >
                    <StoreIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedProductForLink(product)}
                    className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-green-500/10"
                    title="Create Payment Link"
                  >
                    <LinkIcon className="w-4 h-4 text-green-500" />
                  </button>
                  <button
                    onClick={() => handleTogglePin(product)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      product.pinned 
                        ? 'bg-base-blue/20 text-base-blue' 
                        : 'bg-muted hover:bg-base-blue/10 text-muted-foreground'
                    }`}
                    title={product.pinned ? 'Unpin from Quick Add' : 'Pin to Quick Add'}
                  >
                    {product.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleSecureEditProduct(product)}
                    className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-base-blue/10"
                  >
                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleSecureDeleteProduct(product)}
                    className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add Button */}
      <div className="fixed bottom-6 right-6">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSecureAddProduct}
          className="w-14 h-14 rounded-full bg-base-blue shadow-lg flex items-center justify-center"
        >
          <Plus className="w-6 h-6 text-white" />
        </motion.button>
      </div>

      {/* Add/Edit Product Modal */}
      <AnimatePresence>
        {showAddProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => resetForm()}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl p-6 w-full max-w-md max-h-[75vh] overflow-y-auto mx-2 mb-[calc(96px+env(safe-area-inset-bottom,0px))] sm:mb-0 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-foreground">
                  {editingProduct ? 'Edit Product' : 'Add Product'}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => resetForm()}
                  className="rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Product Name */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Product Name
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="e.g., Cappuccino"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="h-12 pl-10 rounded-xl"
                    />
                  </div>
                </div>

                {/* Price */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Price (USDC)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="h-12 pl-10 rounded-xl"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setFormCategory(cat)}
                        className={`
                          px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                          ${formCategory === cat 
                            ? 'bg-base-blue text-white' 
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }
                        `}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Description (optional)
                  </label>
                  <Input
                    placeholder="Brief description..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>

                {/* Product Image */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Product Image (optional)
                  </label>
                  <div className="flex items-center gap-3">
                    {imagePreview ? (
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border flex-shrink-0">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          onClick={() => { setImageFile(null); setImagePreview(null); }}
                          className="absolute top-0 right-0 w-5 h-5 bg-destructive rounded-bl-lg flex items-center justify-center"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <label className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <div className="h-10 rounded-xl border border-border flex items-center justify-center text-sm text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                        {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Choose Image'}
                      </div>
                    </label>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Max 5MB. Shown on your public store.</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => resetForm()}
                  className="flex-1 h-12 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveProduct}
                  disabled={isSaving}
                  className="flex-1 h-12 rounded-xl bg-base-blue hover:bg-base-blue/90"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {editingProduct ? 'Update' : 'Add Product'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security Gate Modal */}
      <AnimatePresence>
        {SecurityGateModal}
      </AnimatePresence>

      {/* Payment Link Modal */}
      {selectedProductForLink && profile?.id && (
        <PaymentLinkModal
          isOpen={!!selectedProductForLink}
          onClose={() => setSelectedProductForLink(null)}
          profileId={profile.id}
          product={{
            id: selectedProductForLink.id,
            name: selectedProductForLink.name,
            price: selectedProductForLink.price,
            icon: selectedProductForLink.icon,
          }}
        />
      )}

      {/* Pro Subscription Modal */}
      <AnimatePresence>
        {showSubscriptionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => !isSubscribing && setShowSubscriptionModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl p-6 w-full max-w-md max-h-[75vh] overflow-y-auto mx-2 mb-[calc(96px+env(safe-area-inset-bottom,0px))] sm:mb-0 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">MoniPay Pro</h3>
                    <p className="text-xs text-muted-foreground">Public Storefront</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSubscriptionModal(false)}
                  className="rounded-full"
                  disabled={isSubscribing}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Status / Countdown */}
              {subscriptionStatus?.active ? (
                <div className="bg-success/10 border border-success/20 rounded-2xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-success" />
                    <span className="font-semibold text-success">Pro Active</span>
                  </div>
                  {(() => {
                    const time = getTimeRemaining();
                    if (!time) return null;
                    return (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="font-bold">{time.days}</span>
                          <span className="text-muted-foreground text-xs">days</span>
                          <span className="font-bold">{time.hours}</span>
                          <span className="text-muted-foreground text-xs">hrs remaining</span>
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground mt-2">
                    Expires: {new Date(subscriptionStatus.expiresAt!).toLocaleDateString('en-US', { 
                      month: 'long', day: 'numeric', year: 'numeric' 
                    })}
                  </p>
                </div>
              ) : subscriptionStatus?.gracePeriod ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold text-amber-500">Grace Period</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your subscription expired. Renew to keep your storefront active.
                  </p>
                </div>
              ) : null}

              {/* Features */}
              <div className="space-y-2 mb-5">
                <p className="text-sm font-semibold text-foreground">What you get:</p>
                {[
                  'Public storefront at monipay.xyz/store/@tag',
                  'Product images & descriptions',
                  'Shareable store URL',
                  'Online payment acceptance',
                ].map((feat) => (
                  <div key={feat} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-success flex-shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              {/* Price */}
              <div className="bg-muted rounded-2xl p-4 mb-5 text-center">
                <p className="text-3xl font-bold text-foreground">${SUBSCRIPTION_AMOUNT}</p>
                <p className="text-sm text-muted-foreground">per month • paid to @monibot</p>
              </div>

              {/* Status feedback */}
              {subscribeStep === 'done' && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-4 text-center">
                  <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-green-500">Subscription Activated!</p>
                  <p className="text-xs text-muted-foreground mt-1">Your storefront is now live</p>
                </div>
              )}

              {subscribeStep === 'error' && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 mb-4 text-center">
                  <AlertCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
                  <p className="text-sm font-semibold text-destructive">Payment Failed</p>
                  <p className="text-xs text-muted-foreground mt-1">{subscribeError}</p>
                </div>
              )}

              {/* Subscribe / Renew Button */}
              <Button
                onClick={() => {
                  setSubscribeStep(null);
                  setSubscribeError(null);
                  handleSubscribe();
                }}
                disabled={isSubscribing || subscribeStep === 'done'}
                className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-base"
              >
                {subscribeStep === 'paying' ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Sending Payment...
                  </>
                ) : subscribeStep === 'activating' ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Activating Subscription...
                  </>
                ) : subscribeStep === 'done' ? (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Activated!
                  </>
                ) : subscribeStep === 'error' ? (
                  <>
                    <Crown className="w-5 h-5 mr-2" />
                    Try Again
                  </>
                ) : subscriptionStatus?.active ? (
                  <>
                    <Crown className="w-5 h-5 mr-2" />
                    Extend Subscription
                  </>
                ) : (
                  <>
                    <Crown className="w-5 h-5 mr-2" />
                    Subscribe for ${SUBSCRIPTION_AMOUNT}/mo
                  </>
                )}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center mt-3">
                Payment will be sent from your MoniPay wallet to @monibot
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
