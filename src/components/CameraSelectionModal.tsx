import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Camera, Check, Sparkles } from 'lucide-react';
import { setCameraPreference } from '@/hooks/useCameraPreference';

const CAMERA_SETUP_COMPLETE_KEY = 'monipay_camera_setup_complete';

interface CameraSelectionModalProps {
  cameras: MediaDeviceInfo[];
  onComplete: (selectedDeviceId: string, selectedLabel: string) => void;
  isIOS: boolean;
}

export function CameraSelectionModal({ cameras, onComplete, isIOS }: CameraSelectionModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Score cameras to identify the 1x Main
  const scoredCameras = useMemo(() => {
    return cameras.map((cam, idx) => {
      const label = cam.label.toLowerCase();
      let score = 0;
      
      // Identify 1x Main camera
      if (label.includes('1x')) score += 500;
      if (label.includes('main')) score += 400;
      if (label.includes('camera 0') || label.includes('camera2 0')) score += 150;
      if (label.includes('back 0') || label.includes('rear 0')) score += 100;
      
      // Penalize non-main cameras
      const cameraNumMatch = label.match(/camera\s*(\d+)/i);
      if (cameraNumMatch) {
        const camNum = parseInt(cameraNumMatch[1], 10);
        if (camNum >= 2) score -= camNum * 100;
      }
      
      if (label.includes('ultra')) score -= 300;
      if (label.includes('macro')) score -= 300;
      if (label.includes('tele')) score -= 200;
      if (label.includes('0.5x') || label.includes('0.6x')) score -= 300;
      
      score -= idx * 5;
      
      return { camera: cam, score, isRecommended: false };
    }).sort((a, b) => b.score - a.score).map((item, idx) => ({
      ...item,
      isRecommended: idx === 0 && item.score > 0
    }));
  }, [cameras]);
  
  // Pre-select the recommended camera
  useEffect(() => {
    const recommended = scoredCameras.find(c => c.isRecommended);
    if (recommended && !selectedId) {
      setSelectedId(recommended.camera.deviceId);
    }
  }, [scoredCameras, selectedId]);
  
  const handleConfirm = () => {
    if (selectedId) {
      const selectedCamera = cameras.find(c => c.deviceId === selectedId);
      if (selectedCamera) {
        // IMPORTANT: Save the LABEL, not the deviceId!
        // deviceIds are ephemeral on Android and change between sessions.
        // Labels are stable and can be matched later.
        console.log('[CameraSetup] Saving camera LABEL:', selectedCamera.label);
        setCameraPreference(selectedCamera.label);
        localStorage.setItem(CAMERA_SETUP_COMPLETE_KEY, 'true');
        onComplete(selectedId, selectedCamera.label);
      }
    }
  };
  
  // Format camera label for display
  const formatLabel = (label: string) => {
    // Try to make it more readable
    if (label.toLowerCase().includes('1x') || label.toLowerCase().includes('main')) {
      return '1x Main Camera';
    }
    if (label.toLowerCase().includes('ultra') || label.toLowerCase().includes('0.5x') || label.toLowerCase().includes('0.6x')) {
      return 'Ultra-wide Camera';
    }
    if (label.toLowerCase().includes('macro')) {
      return 'Macro Camera';
    }
    if (label.toLowerCase().includes('tele') || label.toLowerCase().includes('2x') || label.toLowerCase().includes('3x')) {
      return 'Telephoto Camera';
    }
    // Default: show original but truncated
    return label.length > 30 ? label.slice(0, 30) + '...' : label;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-base-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Select Your Camera</h2>
          <p className="text-white/60 text-sm">
            Choose the <span className="text-primary font-semibold">1x Main</span> camera for best QR scanning. 
            This is a one-time setup.
          </p>
        </div>
        
        {/* Camera list */}
        <div className="space-y-3 mb-8">
          {scoredCameras.map(({ camera, isRecommended }) => (
            <motion.button
              key={camera.deviceId}
              onClick={() => setSelectedId(camera.deviceId)}
              whileTap={{ scale: 0.98 }}
              className={`
                w-full p-4 rounded-2xl border-2 transition-all duration-200 text-left
                ${selectedId === camera.deviceId 
                  ? 'border-primary bg-primary/10' 
                  : 'border-white/10 bg-white/5 hover:border-white/20'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium truncate">
                      {formatLabel(camera.label)}
                    </span>
                    {isRecommended && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold shrink-0">
                        <Sparkles className="w-3 h-3" />
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-white/40 text-xs mt-1 truncate">
                    {camera.label}
                  </p>
                </div>
                <div className={`
                  w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ml-3
                  ${selectedId === camera.deviceId 
                    ? 'border-primary bg-primary' 
                    : 'border-white/30'
                  }
                `}>
                  {selectedId === camera.deviceId && (
                    <Check className="w-4 h-4 text-white" />
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
        
        {/* Confirm button */}
        <Button
          onClick={handleConfirm}
          disabled={!selectedId}
          className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 rounded-2xl"
        >
          Use This Camera
        </Button>
        
        <p className="text-center text-white/40 text-xs mt-4">
          You can change this later in Settings
        </p>
      </motion.div>
    </motion.div>
  );
}

// Helper to check if camera setup is complete
export function isCameraSetupComplete(): boolean {
  try {
    return localStorage.getItem(CAMERA_SETUP_COMPLETE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Helper to reset camera setup (for testing/settings)
export function resetCameraSetup(): void {
  try {
    localStorage.removeItem(CAMERA_SETUP_COMPLETE_KEY);
  } catch {}
}
