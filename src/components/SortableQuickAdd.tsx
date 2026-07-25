import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Coffee, ShoppingBag, Utensils, Sparkles, Package, GripVertical } from 'lucide-react';
import { Product } from './ProductCatalog';
import { usePayTag } from '@/contexts/PayTagContext';


const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  coffee: Coffee,
  shopping: ShoppingBag,
  utensils: Utensils,
  sparkles: Sparkles,
  package: Package,
};

const SUPABASE_FUNCTIONS_URL = 'https://vdaeojxonqmzejwiioaq.supabase.co/functions/v1';

interface SortableProductProps {
  product: Product;
  onClick: () => void;
}

function SortableProduct({ product, onClick }: SortableProductProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.8 : 1,
  };

  const IconComponent = iconMap[product.icon] || Package;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex-shrink-0 w-[calc(25%-6px)] min-w-[72px] max-w-[100px] bg-card border rounded-xl p-2 lg:p-3 text-center transition-colors snap-start relative ${
        product.pinned ? 'border-base-blue/30' : 'border-border'
      } ${isDragging ? 'shadow-lg scale-105' : ''}`}
    >
      {/* Drag Handle - only for pinned products */}
      {product.pinned && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 left-1 w-5 h-5 rounded bg-muted/50 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
      )}
      
      {product.pinned && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-base-blue rounded-full flex items-center justify-center">
          <span className="text-white text-[8px]">★</span>
        </div>
      )}
      
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className="w-full"
      >
        <IconComponent className="w-5 h-5 lg:w-6 lg:h-6 mx-auto mb-1 text-base-blue" />
        <span className="text-[10px] lg:text-xs font-medium text-foreground block truncate">{product.name}</span>
        <span className="text-[10px] lg:text-xs text-muted-foreground">${product.price.toFixed(2)}</span>
      </motion.button>
    </div>
  );
}

interface SortableQuickAddProps {
  products: Product[];
  onProductsChange: (products: Product[]) => void;
  onProductClick: (product: Product) => void;
}

export function SortableQuickAdd({ products, onProductsChange, onProductClick }: SortableQuickAddProps) {
  const { profile } = usePayTag();
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sort products: pinned first (by sortOrder), then unpinned
  const sortedProducts = [...products].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (a.pinned && b.pinned) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    }
    return 0;
  });

  const pinnedProducts = sortedProducts.filter(p => p.pinned);
  const unpinnedProducts = sortedProducts.filter(p => !p.pinned);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = pinnedProducts.findIndex(p => p.id === active.id);
    const newIndex = pinnedProducts.findIndex(p => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedPinned = arrayMove(pinnedProducts, oldIndex, newIndex);
    
    // Update sort orders
    const reorderData = reorderedPinned.map((p, index) => ({
      id: p.id,
      sortOrder: index,
    }));

    // Update local state immediately for responsiveness
    const updatedProducts = products.map(p => {
      const reordered = reorderData.find(r => r.id === p.id);
      if (reordered) {
        return { ...p, sortOrder: reordered.sortOrder };
      }
      return p;
    });
    onProductsChange(updatedProducts);

    // Persist to database
    setIsSaving(true);
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          profileId: profile?.id,
          reorderData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save order');
      }
    } catch (error) {
      console.error('Reorder error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [pinnedProducts, products, onProductsChange, profile?.id]);

  return (
    <div className="relative">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
          <SortableContext
            items={pinnedProducts.map(p => p.id)}
            strategy={horizontalListSortingStrategy}
          >
            {pinnedProducts.map((product) => (
              <SortableProduct
                key={product.id}
                product={product}
                onClick={() => onProductClick(product)}
              />
            ))}
          </SortableContext>
          
          {/* Non-pinned products (not draggable) */}
          {unpinnedProducts.map((product) => {
            const IconComponent = iconMap[product.icon] || Package;
            return (
              <motion.button
                key={product.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => onProductClick(product)}
                className="flex-shrink-0 w-[calc(25%-6px)] min-w-[72px] max-w-[100px] bg-card border border-border rounded-xl p-2 lg:p-3 text-center hover:border-base-blue/50 transition-colors snap-start"
              >
                <IconComponent className="w-5 h-5 lg:w-6 lg:h-6 mx-auto mb-1 text-base-blue" />
                <span className="text-[10px] lg:text-xs font-medium text-foreground block truncate">{product.name}</span>
                <span className="text-[10px] lg:text-xs text-muted-foreground">${product.price.toFixed(2)}</span>
              </motion.button>
            );
          })}
        </div>
      </DndContext>
      
      {products.length > 4 && (
        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
      )}
      
      {isSaving && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <div className="text-xs text-muted-foreground">Saving...</div>
        </div>
      )}
    </div>
  );
}
