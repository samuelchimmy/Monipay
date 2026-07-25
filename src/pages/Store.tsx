import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { 
  Package, Loader2, AlertTriangle, ArrowLeft, Search,
  ShoppingBag, ExternalLink, Store as StoreIcon, Edit2, Save,
  X, Plus, Twitter, Instagram, Globe, Send, Palette, Check,
  Image as ImageIcon, Trash2, Copy, Minus, ShoppingCart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MoniPayLogo } from '@/components/MoniPayLogo';
import { signedFetch } from '@/lib/signedFetch';
import { toast } from '@/components/ui/use-toast';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/integrations/supabase/client';
import { PageMeta } from '@/components/PageMeta';
import { getStoreSchema } from '@/lib/schema';

const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface StoreProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  description: string;
  imageUrl?: string | null;
  stockQuantity?: number | null; // null = unlimited, 0 = out of stock
}

interface StoreMerchant {
  payTag: string;
  walletAddress: string;
  preferredNetwork: string;
}

interface StoreSettings {
  tagline?: string | null;
  accentColor?: string;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  socialTwitter?: string | null;
  socialInstagram?: string | null;
  socialWebsite?: string | null;
  socialTelegram?: string | null;
  showBranding?: boolean;
}

interface CartItem {
  product: StoreProduct;
  quantity: number;
}

const MAX_ITEM_QUANTITY = 99;

/* ─── Grid background ─── */
function GridBg() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}

/* ─── Reveal animation ─── */
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const ACCENT_PRESETS = [
  '#0052FF', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', 
  '#10B981', '#06B6D4', '#6366F1', '#000000', '#6B7280'
];

const CATEGORIES = ['Food', 'Drinks', 'Services', 'Retail', 'Other'];

/* ─── Cart helpers ─── */
function getCartKey(payTag: string) {
  return `monipay_cart_${payTag.toLowerCase()}`;
}

function loadCart(payTag: string): CartItem[] {
  try {
    const stored = localStorage.getItem(getCartKey(payTag));
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveCart(payTag: string, items: CartItem[]) {
  localStorage.setItem(getCartKey(payTag), JSON.stringify(items));
}

export default function Store() {
  const { payTag } = useParams<{ payTag: string }>();
  const navigate = useNavigate();
  const [ownerPayTag, setOwnerPayTag] = useState<string | null>(null);
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('paytag_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        setOwnerPayTag(parsed.payTag?.toLowerCase() || null);
        setOwnerProfileId(parsed.id || null);
      }
    } catch {}
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [merchant, setMerchant] = useState<StoreMerchant | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [subscriptionActive, setSubscriptionActive] = useState<boolean | null>(null);

  // Cart state
  const cleanTag = payTag?.replace(/^@/, '').toLowerCase() || '';
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<StoreProduct | null>(null);
  const [cartPulse, setCartPulse] = useState(false);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [shippingInfo, setShippingInfo] = useState({
    fullName: '', email: '', phone: '', address: '', city: '', state: '', zip: '', country: '',
  });
  const [shippingErrors, setShippingErrors] = useState<Record<string, string>>({});

  // Load cart from localStorage once merchant is known
  useEffect(() => {
    if (cleanTag) {
      setCart(loadCart(cleanTag));
    }
  }, [cleanTag]);

  // Persist cart changes
  useEffect(() => {
    if (cleanTag) {
      saveCart(cleanTag, cart);
    }
  }, [cart, cleanTag]);

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const isOutOfStock = (product: StoreProduct) => product.stockQuantity === 0;

  const addToCart = (product: StoreProduct) => {
    if (isOutOfStock(product)) {
      toast({ title: 'Out of stock', description: `${product.name} is currently unavailable.`, variant: 'destructive' });
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      const maxQty = product.stockQuantity != null ? Math.min(MAX_ITEM_QUANTITY, product.stockQuantity) : MAX_ITEM_QUANTITY;
      if (existing) {
        if (existing.quantity >= maxQty) {
          toast({ title: maxQty < MAX_ITEM_QUANTITY ? 'Stock limit reached' : 'Quantity limit reached', description: `Maximum ${maxQty} available.`, variant: 'destructive' });
          return prev;
        }
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
    feedback('success');
    toast({ title: 'Added to cart', description: `${product.name} added.` });
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 600);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.product.id !== productId) return i;
        const newQty = i.quantity + delta;
        if (newQty > MAX_ITEM_QUANTITY) {
          toast({ title: 'Quantity limit reached', description: `Maximum ${MAX_ITEM_QUANTITY} per item.`, variant: 'destructive' });
          return i;
        }
        return newQty <= 0 ? null : { ...i, quantity: newQty };
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    if (cleanTag) {
      localStorage.removeItem(getCartKey(cleanTag));
    }
  };

  const validateShipping = (): boolean => {
    const errors: Record<string, string> = {};
    // Only validate email format if provided
    if (shippingInfo.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingInfo.email.trim())) {
      errors.email = 'Invalid email format';
    }
    setShippingErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProceedToShipping = () => {
    setShowShippingForm(true);
  };

  const handleCheckout = async () => {
    if (!merchant || cart.length === 0) return;
    if (!validateShipping()) return;
    setIsCheckingOut(true);
    try {
      const items = cart.map(item => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        category: item.product.category,
        imageUrl: item.product.imageUrl || null,
      }));

      const { data: orderData, error: orderError } = await supabase.functions.invoke('orders', {
        body: {
          action: 'create',
          merchantId: merchant.payTag,
          amount: cartTotal,
          source: 'payment_link',
          metadata: {
            items,
            storefront: true,
            storePayTag: merchant.payTag,
            shipping: {
              fullName: shippingInfo.fullName.trim(),
              email: shippingInfo.email.trim(),
              phone: shippingInfo.phone.trim(),
              address: shippingInfo.address.trim(),
              city: shippingInfo.city.trim(),
              state: shippingInfo.state.trim(),
              zip: shippingInfo.zip.trim(),
              country: shippingInfo.country.trim(),
            },
          },
          callbackUrl: `${window.location.origin}/store/@${merchant.payTag}?paid=true`,
        },
      });

      if (orderError || !orderData?.order) {
        throw new Error('Failed to create order');
      }

      clearCart();
      setShowShippingForm(false);
      setShippingInfo({ fullName: '', email: '', phone: '', address: '', city: '', state: '', zip: '', country: '' });
      navigate(`/pay?orderId=${orderData.order.id}`);
    } catch (err: any) {
      toast({ title: 'Checkout failed', description: err.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editSettings, setEditSettings] = useState<StoreSettings>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // Add product modal
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addProductForm, setAddProductForm] = useState({ name: '', price: '', category: 'Other', description: '' });
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  const isOwner = ownerPayTag === cleanTag;
  const accent = (isEditing ? editSettings.accentColor : storeSettings?.accentColor) || '#0052FF';

  // Handle ?paid=true callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid') === 'true') {
      feedback('success');
      // Clear the cart after successful payment
      clearCart();
      // Show confirmation toast with cart-cleared note
      toast({
        title: '🎉 Payment successful!',
        description: 'Thank you for your purchase. Your cart has been cleared.',
      });
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // SEO handled declaratively via <PageMeta> in render below.

  // Fetch store data
  useEffect(() => {
    if (!cleanTag) { setError('Invalid store URL'); setIsLoading(false); return; }
    const fetchStore = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [storeRes, subRes] = await Promise.all([
          fetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'listPublic', payTag: cleanTag }),
          }),
          fetch(`${SUPABASE_FUNCTIONS_URL}/merchant-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'checkStatus', payTag: cleanTag }),
          }),
        ]);
        if (!storeRes.ok) {
          const data = await storeRes.json().catch(() => ({}));
          throw new Error(data.error || 'Store not found');
        }
        const storeData = await storeRes.json();
        setMerchant(storeData.merchant);
        setProducts(storeData.products);
        setStoreSettings(storeData.storeSettings || null);
        if (subRes.ok) {
          const subData = await subRes.json();
          setSubscriptionActive(subData.active || subData.gracePeriod || false);
        } else {
          setSubscriptionActive(false);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load store');
      } finally {
        setIsLoading(false);
      }
    };
    fetchStore();
  }, [cleanTag]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return Array.from(cats).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = !selectedCategory || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, selectedCategory]);

  const handleStartEdit = () => {
    setEditSettings({
      tagline: storeSettings?.tagline || '',
      accentColor: storeSettings?.accentColor || '#0052FF',
      socialTwitter: storeSettings?.socialTwitter || '',
      socialInstagram: storeSettings?.socialInstagram || '',
      socialWebsite: storeSettings?.socialWebsite || '',
      socialTelegram: storeSettings?.socialTelegram || '',
    });
    setIsEditing(true);
  };

  const handleSaveSettings = async () => {
    if (!ownerProfileId) return;
    setIsSavingSettings(true);
    try {
      const res = await signedFetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveStoreSettings', profileId: ownerProfileId, storeSettings: editSettings }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setStoreSettings(editSettings);
      setIsEditing(false);
      toast({ title: 'Store updated', description: 'Your storefront settings have been saved.' });
      feedback('success');
    } catch {
      toast({ title: 'Error', description: 'Failed to save store settings.', variant: 'destructive' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddProduct = async () => {
    if (!ownerProfileId || !addProductForm.name || !addProductForm.price) return;
    setIsAddingProduct(true);
    try {
      const res = await signedFetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          profileId: ownerProfileId,
          product: {
            name: addProductForm.name,
            price: parseFloat(addProductForm.price),
            category: addProductForm.category,
            description: addProductForm.description,
            icon: 'package',
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to add product');
      const data = await res.json();
      setProducts(prev => [data.product, ...prev]);
      setShowAddProduct(false);
      setAddProductForm({ name: '', price: '', category: 'Other', description: '' });
      toast({ title: 'Product added!', description: `${data.product.name} is now in your store.` });
      feedback('success');
    } catch {
      toast({ title: 'Error', description: 'Failed to add product.', variant: 'destructive' });
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!ownerProfileId) return;
    try {
      const res = await signedFetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', profileId: ownerProfileId, productId }),
      });
      if (!res.ok) throw new Error('Failed');
      setProducts(prev => prev.filter(p => p.id !== productId));
      feedback('success');
    } catch {
      toast({ title: 'Error', description: 'Failed to delete product.', variant: 'destructive' });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/store/@${merchant?.payTag}`);
    toast({ title: 'Link copied!', description: 'Store URL copied to clipboard.' });
    feedback('copy');
  };

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading store...</p>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (error || !merchant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-none bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Store Not Found</h1>
          <p className="text-muted-foreground mb-6 text-sm">{error || "This merchant doesn't exist."}</p>
          <Button variant="outline" onClick={() => navigate('/')} className="rounded-none">
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Still loading subscription status for non-owners
  if (subscriptionActive === null && !isOwner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Subscription gate
  if (subscriptionActive === false && !isOwner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        <GridBg />
        <div className="text-center max-w-sm relative z-10">
          <div className="w-20 h-20 rounded-none bg-muted flex items-center justify-center mx-auto mb-5">
            <StoreIcon className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mb-2">Store Not Set Up Yet</h1>
          <p className="text-muted-foreground mb-1 text-sm">
            <span className="font-semibold text-foreground">@{merchant.payTag}</span> hasn't set up their storefront yet.
          </p>
          <p className="text-muted-foreground/60 mb-8 text-xs">Check back later — they might be working on something great!</p>
          <div className="flex flex-col gap-2 items-center">
            <Button variant="outline" onClick={() => navigate('/')} className="rounded-none w-48">
              <ArrowLeft className="w-4 h-4 mr-2" /> Go Home
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/pay?merchantId=${merchant.payTag}`)} className="rounded-none text-xs text-muted-foreground">
              Pay @{merchant.payTag} directly →
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const tagline = isEditing ? editSettings.tagline : storeSettings?.tagline;
  const socialLinks = [
    { key: 'twitter', icon: Twitter, value: isEditing ? editSettings.socialTwitter : storeSettings?.socialTwitter, prefix: 'https://x.com/' },
    { key: 'instagram', icon: Instagram, value: isEditing ? editSettings.socialInstagram : storeSettings?.socialInstagram, prefix: 'https://instagram.com/' },
    { key: 'telegram', icon: Send, value: isEditing ? editSettings.socialTelegram : storeSettings?.socialTelegram, prefix: 'https://t.me/' },
    { key: 'website', icon: Globe, value: isEditing ? editSettings.socialWebsite : storeSettings?.socialWebsite, prefix: '' },
  ].filter(s => s.value);

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {merchant && (
        <PageMeta
          title={`@${merchant.payTag} Store`}
          description={storeSettings?.tagline || `Browse products from @${merchant.payTag} on MoniPay. Pay with crypto, gasless checkout.`}
          path={`/store/@${merchant.payTag}`}
          ogImage={storeSettings?.bannerUrl || storeSettings?.logoUrl || 'https://monipay.xyz/og/default.png'}
          jsonLd={getStoreSchema({
            payTag: merchant.payTag,
            tagline: storeSettings?.tagline ?? undefined,
            bannerUrl: storeSettings?.bannerUrl ?? undefined,
            logoUrl: storeSettings?.logoUrl ?? undefined,
          })}
          breadcrumbs={[
            { name: 'Home', url: 'https://monipay.xyz/' },
            { name: `@${merchant.payTag}`, url: `https://monipay.xyz/store/@${merchant.payTag}` },
          ]}
        />
      )}
      <GridBg />

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-foreground/5">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/">
            <MoniPayLogo size={28} color="#0052FF" animationMode="idle" showText textSize={14} />
          </Link>
          <div className="flex items-center gap-2">
            {isOwner && !isEditing && (
              <Button size="sm" variant="outline" onClick={handleStartEdit} className="rounded-none text-xs gap-1.5 h-8">
                <Edit2 className="w-3.5 h-3.5" /> Edit Store
              </Button>
            )}
            {isOwner && isEditing && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-none text-xs h-8">
                  <X className="w-3.5 h-3.5 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSaveSettings} disabled={isSavingSettings} className="rounded-none text-xs h-8 gap-1.5" style={{ backgroundColor: accent }}>
                  {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={handleCopyLink} className="rounded-none text-xs h-8 gap-1">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            {/* Cart button (visitors only) */}
            {!isOwner && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCart(true)}
                className="rounded-none text-xs h-8 gap-1.5 relative"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                {cartCount > 0 && (
                  <motion.span
                    animate={cartPulse ? { scale: [1, 1.4, 1] } : {}}
                    transition={{ duration: 0.3 }}
                    className="absolute -top-1.5 -right-1.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center min-w-[18px] h-[18px]"
                    style={{ backgroundColor: accent }}
                  >
                    {cartCount}
                  </motion.span>
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero Banner ─── */}
      <section className="relative">
        <div className="h-32 sm:h-40 relative overflow-hidden" style={{ backgroundColor: accent }}>
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: `linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }} />
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="max-w-5xl mx-auto px-6 -mt-12 relative z-10">
          <div className="flex items-end gap-4 sm:gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-none border-4 border-background flex items-center justify-center text-3xl font-extrabold text-white shrink-0" style={{ backgroundColor: accent }}>
              {merchant.payTag.charAt(0).toUpperCase()}
            </div>
            <div className="pb-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">@{merchant.payTag}</h1>
              {tagline && <p className="text-sm text-muted-foreground mt-0.5 max-w-md">{tagline}</p>}
              {!tagline && isEditing && <p className="text-sm text-muted-foreground/50 mt-0.5 italic">Add a tagline...</p>}
            </div>
          </div>

          {/* Social links */}
          {(socialLinks.length > 0 || isEditing) && (
            <div className="flex items-center gap-3 mt-4">
              {socialLinks.map(s => (
                <a
                  key={s.key}
                  href={s.prefix ? `${s.prefix}${s.value}` : (s.value?.startsWith('http') ? s.value : `https://${s.value}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-none border border-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                >
                  <s.icon className="w-3.5 h-3.5" />
                </a>
              ))}
              <span className="text-xs text-muted-foreground/40 ml-1">
                {products.length} {products.length === 1 ? 'product' : 'products'}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ─── Edit Panel ─── */}
      {isEditing && (
        <Reveal className="max-w-5xl mx-auto px-6 mt-6">
          <div className="bg-card border border-foreground/10 rounded-none p-5 space-y-5">
            <h3 className="text-xs font-bold tracking-[0.15em] uppercase text-foreground/40">Store Settings</h3>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tagline</label>
              <Input
                placeholder="What does your store sell?"
                value={editSettings.tagline || ''}
                onChange={e => setEditSettings(s => ({ ...s, tagline: e.target.value }))}
                className="rounded-none h-9 text-sm"
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Accent Color</label>
              <div className="flex flex-wrap gap-2">
                {ACCENT_PRESETS.map(color => (
                  <button
                    key={color}
                    onClick={() => setEditSettings(s => ({ ...s, accentColor: color }))}
                    className="w-8 h-8 rounded-none border-2 transition-all flex items-center justify-center"
                    style={{
                      backgroundColor: color,
                      borderColor: editSettings.accentColor === color ? 'hsl(var(--foreground))' : 'transparent',
                    }}
                  >
                    {editSettings.accentColor === color && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5"><Twitter className="w-3 h-3" /> Twitter/X</label>
                <Input placeholder="username" value={editSettings.socialTwitter || ''} onChange={e => setEditSettings(s => ({ ...s, socialTwitter: e.target.value }))} className="rounded-none h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5"><Instagram className="w-3 h-3" /> Instagram</label>
                <Input placeholder="username" value={editSettings.socialInstagram || ''} onChange={e => setEditSettings(s => ({ ...s, socialInstagram: e.target.value }))} className="rounded-none h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5"><Send className="w-3 h-3" /> Telegram</label>
                <Input placeholder="username" value={editSettings.socialTelegram || ''} onChange={e => setEditSettings(s => ({ ...s, socialTelegram: e.target.value }))} className="rounded-none h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5"><Globe className="w-3 h-3" /> Website</label>
                <Input placeholder="yoursite.com" value={editSettings.socialWebsite || ''} onChange={e => setEditSettings(s => ({ ...s, socialWebsite: e.target.value }))} className="rounded-none h-9 text-sm" />
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* ─── Add Product (Owner) ─── */}
      {isOwner && (
        <Reveal className="max-w-5xl mx-auto px-6 mt-6" delay={0.05}>
          {!showAddProduct ? (
            <button
              onClick={() => setShowAddProduct(true)}
              className="w-full border-2 border-dashed border-foreground/10 hover:border-foreground/20 rounded-none py-4 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Product
            </button>
          ) : (
            <div className="bg-card border border-foreground/10 rounded-none p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold tracking-[0.15em] uppercase text-foreground/40">New Product</h3>
                <button onClick={() => setShowAddProduct(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input placeholder="Product name" value={addProductForm.name} onChange={e => setAddProductForm(f => ({ ...f, name: e.target.value }))} className="rounded-none h-9 text-sm" />
                <Input placeholder="Price (USD)" type="number" step="0.01" value={addProductForm.price} onChange={e => setAddProductForm(f => ({ ...f, price: e.target.value }))} className="rounded-none h-9 text-sm" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <select
                  value={addProductForm.category}
                  onChange={e => setAddProductForm(f => ({ ...f, category: e.target.value }))}
                  className="h-9 rounded-none border border-input bg-background px-3 text-sm"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Input placeholder="Short description" value={addProductForm.description} onChange={e => setAddProductForm(f => ({ ...f, description: e.target.value }))} className="rounded-none h-9 text-sm" />
              </div>
              <Button onClick={handleAddProduct} disabled={isAddingProduct || !addProductForm.name || !addProductForm.price} className="rounded-none h-9 text-xs" style={{ backgroundColor: accent }}>
                {isAddingProduct ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                Add Product
              </Button>
            </div>
          )}
        </Reveal>
      )}

      {/* ─── Search & Filters ─── */}
      <div className="max-w-5xl mx-auto px-6 mt-8">
        {products.length > 0 && (
          <Reveal className="space-y-3" delay={0.1}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-10 rounded-none border-foreground/10"
              />
            </div>
            {categories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 text-[11px] font-bold tracking-wide transition-colors whitespace-nowrap ${
                    selectedCategory === null 
                      ? 'text-white' 
                      : 'bg-secondary text-foreground/50 hover:text-foreground'
                  }`}
                  style={selectedCategory === null ? { backgroundColor: accent } : {}}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-[11px] font-bold tracking-wide transition-colors whitespace-nowrap ${
                      selectedCategory === cat 
                        ? 'text-white' 
                        : 'bg-secondary text-foreground/50 hover:text-foreground'
                    }`}
                    style={selectedCategory === cat ? { backgroundColor: accent } : {}}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </Reveal>
        )}
      </div>

      {/* ─── Product Grid ─── */}
      <main className="max-w-5xl mx-auto px-6 mt-6 pb-24 relative z-10">
        {filteredProducts.length === 0 ? (
          <Reveal className="text-center py-20">
            <Package className="w-12 h-12 mx-auto text-foreground/10 mb-4" />
            <p className="text-muted-foreground text-sm">
              {products.length === 0 ? 'No products yet.' : 'No products match your search.'}
            </p>
            {isOwner && products.length === 0 && (
              <p className="text-xs text-muted-foreground/50 mt-2">Click "Add Product" above to get started.</p>
            )}
          </Reveal>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredProducts.map((product, i) => {
              const inCart = cart.find(c => c.product.id === product.id);
              return (
                <Reveal key={product.id} delay={0.03 * Math.min(i, 8)}>
                  <div className="group bg-card border border-foreground/5 rounded-none overflow-hidden hover:border-foreground/15 transition-all relative">
                    {/* Product image — click to quick view */}
                    {product.imageUrl ? (
                      <div className="aspect-square overflow-hidden bg-muted cursor-pointer" onClick={() => setQuickViewProduct(product)}>
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    ) : (
                      <div className="aspect-square flex items-center justify-center cursor-pointer" style={{ backgroundColor: `${accent}10` }} onClick={() => setQuickViewProduct(product)}>
                        <Package className="w-10 h-10" style={{ color: `${accent}40` }} />
                      </div>
                    )}

                    {/* Product info */}
                    <div className="p-3 sm:p-4">
                      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground/50 mb-1">{product.category}</p>
                      <h3 className="text-sm font-bold text-foreground truncate">{product.name}</h3>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{product.description}</p>
                      )}
                      {/* Stock badge */}
                      {isOutOfStock(product) && (
                        <span className="inline-block text-[10px] font-bold tracking-wide uppercase text-destructive bg-destructive/10 px-2 py-0.5 mt-1">Out of Stock</span>
                      )}
                      {product.stockQuantity != null && product.stockQuantity > 0 && product.stockQuantity <= 5 && (
                        <span className="inline-block text-[10px] font-bold tracking-wide uppercase text-amber-600 bg-amber-500/10 px-2 py-0.5 mt-1">Only {product.stockQuantity} left</span>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-base font-extrabold" style={{ color: accent }}>${product.price.toFixed(2)}</span>
                        {isOwner ? (
                          <span className="text-xs text-muted-foreground">Owner</span>
                        ) : isOutOfStock(product) ? (
                          <span className="text-xs text-muted-foreground italic">Unavailable</span>
                        ) : inCart ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQuantity(product.id, -1)}
                              className="w-6 h-6 rounded-none border border-foreground/10 flex items-center justify-center text-foreground/60 hover:text-foreground"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold w-5 text-center">{inCart.quantity}</span>
                            <button
                              onClick={() => updateQuantity(product.id, 1)}
                              className="w-6 h-6 rounded-none border border-foreground/10 flex items-center justify-center text-foreground/60 hover:text-foreground"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => addToCart(product)}
                            className="rounded-none h-7 px-3 text-[11px] font-bold gap-1"
                            style={{ backgroundColor: accent }}
                          >
                            <Plus className="w-3 h-3" /> Add
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Owner delete */}
                    {isOwner && (
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="absolute top-2 right-2 w-7 h-7 bg-background/80 backdrop-blur border border-foreground/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </main>

      {/* ─── Floating Cart Bar ─── */}
      <AnimatePresence>
        {!isOwner && cartCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-background/80 backdrop-blur-lg border-t border-foreground/10"
          >
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{cartCount} {cartCount === 1 ? 'item' : 'items'}</p>
                <p className="text-xs text-muted-foreground">Total: <span className="font-bold text-foreground">${cartTotal.toFixed(2)}</span></p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCart(true)}
                  className="rounded-none text-xs h-9"
                >
                  View Cart
                </Button>
                <Button
                  size="sm"
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="rounded-none text-xs h-9 gap-1.5"
                  style={{ backgroundColor: accent }}
                >
                  {isCheckingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                  Checkout
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Cart Drawer ─── */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40"
              onClick={() => setShowCart(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-background border-l border-foreground/10 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-foreground/10">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Cart ({cartCount})
                </h2>
                <button onClick={() => setShowCart(false)}>
                  <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground/15 mb-4" />
                    <p className="text-sm font-semibold text-foreground mb-1">Your cart is empty</p>
                    <p className="text-xs text-muted-foreground mb-5">Browse the store and add items you like.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCart(false)}
                      className="rounded-none text-xs h-8 gap-1.5"
                    >
                      <ArrowLeft className="w-3 h-3" /> Continue Shopping
                    </Button>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.product.id} className="flex gap-3 p-3 bg-card border border-foreground/5 rounded-none">
                      {item.product.imageUrl ? (
                        <img src={item.product.imageUrl} alt={item.product.name} className="w-14 h-14 object-cover bg-muted shrink-0" />
                      ) : (
                        <div className="w-14 h-14 flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}10` }}>
                          <Package className="w-6 h-6" style={{ color: `${accent}40` }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">${item.product.price.toFixed(2)} each</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <button onClick={() => updateQuantity(item.product.id, -1)} className="w-6 h-6 rounded-none border border-foreground/10 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                          <span className="text-xs font-bold">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.product.id, 1)} className="w-6 h-6 rounded-none border border-foreground/10 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                          <button onClick={() => removeFromCart(item.product.id)} className="ml-auto text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <p className="text-sm font-bold shrink-0" style={{ color: accent }}>
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-4 border-t border-foreground/10 space-y-2.5">
                  {!showShippingForm ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal ({cartCount} {cartCount === 1 ? 'item' : 'items'})</span>
                        <span className="font-bold text-foreground">${cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Platform Fee (1%)</span>
                        <span className="text-muted-foreground">${(cartTotal * 0.01).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Network Fee</span>
                        <span className="font-bold" style={{ color: accent }}>Sponsored ✓</span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-foreground/5">
                        <span className="font-bold text-foreground">You pay</span>
                        <span className="font-extrabold text-foreground">${cartTotal.toFixed(2)}</span>
                      </div>
                      <Button
                        onClick={handleProceedToShipping}
                        className="w-full rounded-none h-11 text-sm font-bold gap-2 mt-1"
                        style={{ backgroundColor: accent }}
                      >
                        <ShoppingBag className="w-4 h-4" /> Continue to Shipping
                      </Button>
                      <button onClick={clearCart} className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1">
                        Clear cart
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-bold text-foreground">Shipping Details</h3>
                        <button onClick={() => setShowShippingForm(false)} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
                      </div>
                      {[
                        { key: 'fullName', label: 'Full Name', placeholder: 'John Doe', type: 'text' },
                        { key: 'email', label: 'Email', placeholder: 'john@example.com', type: 'email' },
                        { key: 'phone', label: 'Phone', placeholder: '+1 234 567 8900', type: 'tel' },
                        { key: 'address', label: 'Address', placeholder: '123 Main Street', type: 'text' },
                        { key: 'city', label: 'City', placeholder: 'Lagos', type: 'text' },
                      ].map(field => (
                        <div key={field.key}>
                          <Input
                            placeholder={field.placeholder}
                            type={field.type}
                            value={(shippingInfo as any)[field.key]}
                            onChange={(e) => {
                              setShippingInfo(prev => ({ ...prev, [field.key]: e.target.value }));
                              if (shippingErrors[field.key]) setShippingErrors(prev => { const n = { ...prev }; delete n[field.key]; return n; });
                            }}
                            className={`rounded-none h-9 text-sm ${shippingErrors[field.key] ? 'border-destructive' : ''}`}
                          />
                          {shippingErrors[field.key] && <p className="text-[10px] text-destructive mt-0.5">{shippingErrors[field.key]}</p>}
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Input
                            placeholder="State / Region"
                            value={shippingInfo.state}
                            onChange={(e) => setShippingInfo(prev => ({ ...prev, state: e.target.value }))}
                            className="rounded-none h-9 text-sm"
                          />
                        </div>
                        <div>
                          <Input
                            placeholder="ZIP / Postal"
                            value={shippingInfo.zip}
                            onChange={(e) => setShippingInfo(prev => ({ ...prev, zip: e.target.value }))}
                            className="rounded-none h-9 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <Input
                          placeholder="Country"
                          value={shippingInfo.country}
                          onChange={(e) => {
                            setShippingInfo(prev => ({ ...prev, country: e.target.value }));
                            if (shippingErrors.country) setShippingErrors(prev => { const n = { ...prev }; delete n.country; return n; });
                          }}
                          className={`rounded-none h-9 text-sm ${shippingErrors.country ? 'border-destructive' : ''}`}
                        />
                        {shippingErrors.country && <p className="text-[10px] text-destructive mt-0.5">{shippingErrors.country}</p>}
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t border-foreground/5">
                        <span className="font-bold text-foreground">Total</span>
                        <span className="font-extrabold text-foreground">${cartTotal.toFixed(2)}</span>
                      </div>
                      <Button
                        onClick={() => { setShowCart(false); handleCheckout(); }}
                        disabled={isCheckingOut}
                        className="w-full rounded-none h-11 text-sm font-bold gap-2"
                        style={{ backgroundColor: accent }}
                      >
                        {isCheckingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                        Pay · ${cartTotal.toFixed(2)}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Product Quick-View Modal ─── */}
      <AnimatePresence>
        {quickViewProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setQuickViewProduct(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-lg bg-background border border-foreground/10 rounded-none overflow-hidden max-h-[80vh] flex flex-col"
            >
              {/* Close */}
              <button
                onClick={() => setQuickViewProduct(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-none bg-background/80 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-foreground border border-foreground/10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Image */}
              {quickViewProduct.imageUrl ? (
                <div className="aspect-[4/3] overflow-hidden bg-muted shrink-0">
                  <img src={quickViewProduct.imageUrl} alt={quickViewProduct.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[4/3] flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}10` }}>
                  <Package className="w-16 h-16" style={{ color: `${accent}30` }} />
                </div>
              )}

              {/* Details */}
              <div className="p-5 space-y-3 overflow-y-auto">
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-muted-foreground/50">{quickViewProduct.category}</p>
                <h3 className="text-lg font-extrabold text-foreground">{quickViewProduct.name}</h3>
                {quickViewProduct.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{quickViewProduct.description}</p>
                )}
                {isOutOfStock(quickViewProduct) && (
                  <span className="inline-block text-xs font-bold tracking-wide uppercase text-destructive bg-destructive/10 px-3 py-1">Out of Stock</span>
                )}
                {quickViewProduct.stockQuantity != null && quickViewProduct.stockQuantity > 0 && quickViewProduct.stockQuantity <= 5 && (
                  <span className="inline-block text-xs font-bold tracking-wide uppercase text-amber-600 bg-amber-500/10 px-3 py-1">Only {quickViewProduct.stockQuantity} left</span>
                )}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-2xl font-extrabold" style={{ color: accent }}>${quickViewProduct.price.toFixed(2)}</span>
                  {!isOwner && !isOutOfStock(quickViewProduct) && (
                    <Button
                      onClick={() => { addToCart(quickViewProduct); setQuickViewProduct(null); }}
                      className="rounded-none h-10 px-5 text-sm font-bold gap-2"
                      style={{ backgroundColor: accent }}
                    >
                      <Plus className="w-4 h-4" /> Add to Cart
                    </Button>
                  )}
                  {!isOwner && isOutOfStock(quickViewProduct) && (
                    <span className="text-sm text-muted-foreground italic">Unavailable</span>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Footer ─── */}
      <footer className="border-t border-foreground/5 py-6 relative z-10">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-xs text-muted-foreground/40">
          <span>Powered by <a href="https://monipay.xyz" className="hover:text-foreground transition-colors" style={{ color: accent }}>MoniPay</a></span>
          <a
            href={`/pay?merchantId=${merchant.payTag}`}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            style={{ color: accent }}
          >
            Pay @{merchant.payTag} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
