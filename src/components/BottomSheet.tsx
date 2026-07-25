import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** Whether to show the drag handle pill at the top */
  showHandle?: boolean;
  /** Custom max-height (default 72vh) */
  maxHeight?: string;
}

/**
 * Reusable floating bottom sheet that sits ABOVE the BottomNav.
 * - 28px all-corner radius (floating card style)
 * - Centered with calc(100% - 32px) width
 * - Drag handle pill
 * - Slide-up animation with spring curve
 * - Backdrop keeps BottomNav visible
 * - clamp()-based text sizing for all content
 */
export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  showHandle = true,
  maxHeight = '72vh',
}: BottomSheetProps) {

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 20 || info.velocity.y > 100) {
      onClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — BottomNav remains visible below */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />

          {/* Floating Sheet */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '110%', opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              mass: 0.8,
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.05}
            dragSnapToOrigin={false}
            onDragEnd={handleDragEnd}
            className="fixed z-50 bg-card flex flex-col overflow-hidden"
            style={{
              /* Sit directly above BottomNav (nav is ~80px + safe area, add 8px gap) */
              bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
              /* Centered floating card */
              left: '16px',
              right: '16px',
              /* All four corners rounded — floating card, NOT bottom-sheet */
              borderRadius: 28,
              maxHeight,
              boxShadow: '0 -8px 40px -8px hsl(0 0% 0% / 0.18), 0 4px 24px -4px hsl(0 0% 0% / 0.10)',
            }}
          >
            {/* Drag Handle */}
            {showHandle && (
              <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
                <div className="w-10 h-1 rounded-full bg-foreground/15" />
              </div>
            )}

            {/* Title */}
            {title && (
              <div className="px-6 pt-2 pb-3">
                <h3
                  className="font-bold text-foreground"
                  style={{ fontSize: 'clamp(15px, 4vw, 18px)' }}
                >
                  {title}
                </h3>
              </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-5">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
