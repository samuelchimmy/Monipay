import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Scanner, IDetectedBarcode, useDevices } from '@yudiel/react-qr-scanner';
import jsQR from 'jsqr';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { setCameraPreference, getCameraPreference } from '@/hooks/useCameraPreference';
import { X, AlertCircle, RotateCcw, ClipboardPaste, Check, Focus, ImageUp, Loader2, SwitchCamera, Flashlight, FlashlightOff } from 'lucide-react';
interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export interface ParsedQRData {
  type: 'monipay' | 'paytag_receive' | 'eip681' | 'address' | 'unknown';
  payTag?: string;
  address?: string;
  amount?: number;
  raw: string;
}

// NOTE: Camera preference is now stored as LABEL (not deviceId) via useCameraPreference hook
// This ensures persistence across sessions since Android deviceIds are ephemeral

/**
 * Parse EIP-681 URI format:
 * ethereum:<contract_address>@<chainId>/transfer?address=<recipient>&uint256=<amount>
 * or: ethereum:<address>@<chainId>?value=<amount>
 */
export function parseEIP681(uri: string): { address: string; amount: number; chainId?: number } | null {
  if (!uri.startsWith('ethereum:')) return null;

  try {
    // Remove the ethereum: prefix
    const withoutPrefix = uri.slice(9);

    // Check for ERC-20 transfer format: <contract>@<chainId>/transfer?address=<recipient>&uint256=<amount>
    const transferMatch = withoutPrefix.match(/^(0x[a-fA-F0-9]{40})(?:@(\d+))?\/transfer\?(.+)$/);

    if (transferMatch) {
      const [, contractAddress, chainIdStr, queryString] = transferMatch;
      const params = new URLSearchParams(queryString);
      const recipientAddress = params.get('address');
      const amountWei = params.get('uint256');

      if (recipientAddress && amountWei) {
        // USDC has 6 decimals
        const amount = parseInt(amountWei, 10) / 1e6;
        return {
          address: recipientAddress,
          amount,
          chainId: chainIdStr ? parseInt(chainIdStr, 10) : undefined,
        };
      }
    }

    // Check for simple ETH transfer format: <address>@<chainId>?value=<amount>
    const ethMatch = withoutPrefix.match(/^(0x[a-fA-F0-9]{40})(?:@(\d+))?(?:\?(.+))?$/);

    if (ethMatch) {
      const [, address, chainIdStr, queryString] = ethMatch;
      const params = queryString ? new URLSearchParams(queryString) : new URLSearchParams();
      const valueWei = params.get('value');

      return {
        address,
        amount: valueWei ? parseInt(valueWei, 10) / 1e18 : 0,
        chainId: chainIdStr ? parseInt(chainIdStr, 10) : undefined,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse QR code data into a structured format
 */
export function parseQRData(data: string): ParsedQRData {
  // Try to parse as JSON first (MoniPay format)
  try {
    const parsed = JSON.parse(data);

    // Handle MoniPay merchant QR (has amount - payment request)
    if (parsed.type === 'monipay' && parsed.payTag) {
      // Multi-address format: resolve correct address from 'addresses' map
      let resolvedAddress = parsed.address; // legacy fallback
      if (parsed.addresses) {
        // If the QR declares a network, use its address; otherwise fall back
        if (parsed.network === 'solana' && parsed.addresses.solana) {
          resolvedAddress = parsed.addresses.solana;
        } else if (parsed.addresses.evm) {
          resolvedAddress = parsed.addresses.evm;
        }
      }
      return {
        type: 'monipay',
        payTag: parsed.payTag,
        address: resolvedAddress,
        amount: parsed.amount,
        raw: data,
      };
    }

    // Handle paytag_receive format (no amount - triggers Send USDC flow)
    if (parsed.type === 'paytag_receive' && (parsed.payTag || parsed.address)) {
      return {
        type: 'paytag_receive',
        payTag: parsed.payTag,
        address: parsed.address,
        raw: data,
      };
    }

    // Unknown JSON format
    return { type: 'unknown', raw: data };
  } catch {
    // Not JSON
  }

  // Check for EIP-681 URI (ethereum:...)
  if (data.startsWith('ethereum:')) {
    const eipData = parseEIP681(data);
    if (eipData) {
      return {
        type: 'eip681',
        address: eipData.address,
        amount: eipData.amount,
        raw: data,
      };
    }
  }

  // Check if it's a plain Ethereum address
  if (data.startsWith('0x') && data.length === 42) {
    return {
      type: 'address',
      address: data,
      raw: data,
    };
  }

  // Unknown format
  return { type: 'unknown', raw: data };
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [scanSuccess, setScanSuccess] = useState(false);
  const [isDecodingImage, setIsDecodingImage] = useState(false);
  
  // Flash/torch state
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const activeStreamRef = useRef<MediaStream | null>(null);
  
  // Camera selection modal state (shows on first use for Android)
  const [showCameraSetup, setShowCameraSetup] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  
  // Track which cameras have torch capability
  const [cameraTorchCapability, setCameraTorchCapability] = useState<Map<string, boolean>>(new Map());

  // ========== Camera device selection ==========
  const devices = useDevices();
  const videoDevices = useMemo(
    () => devices.filter((d) => d.kind === 'videoinput'),
    [devices]
  );

  const isIOS = useMemo(() => /iPad|iPhone|iPod/.test(navigator.userAgent), []);

  // iOS: let the system "virtual camera" manage lenses (default constraints are facingMode-based)
  // Android/Desktop: run smart scoring to avoid ultra-wide/macro/virtual lenses.
  const rearCameras = useMemo(() => {
    // Filter to rear cameras first - only include generic "back/rear" labels
    // Do NOT include numbered cameras like "camera 2" - let scoring decide
    const rear = videoDevices.filter((d) => {
      const label = d.label.toLowerCase();
      return (
        label.includes('back') ||
        label.includes('rear') ||
        label.includes('environment') ||
        label.includes('facing back')
      );
    });

    const candidates = rear.length > 0 ? rear : videoDevices;

    // iOS strategy: do not interfere with Apple's lens switching
    if (isIOS) return candidates;

    // === Android/Desktop strategy: score cameras (higher = more likely main 1x with flash) ===
    const scoreCamera = (label: string, index: number, hasTorch: boolean): number => {
      const lowerLabel = label.toLowerCase();
      let score = 0;

      // ===== HIGHEST PRIORITY: Flash/torch capability =====
      // Cameras with flash are almost always the main 1x camera
      if (hasTorch) score += 600;

      // ===== HIGH PRIORITY: Explicit "1x" or "Main" labels =====
      if (lowerLabel.includes('1x')) score += 500; // Massive boost for 1x
      if (lowerLabel.includes('main')) score += 400;

      // ===== STRONG PENALTIES: Ultra-wide, macro, telephoto =====
      if (lowerLabel.includes('ultra')) score -= 300;
      if (lowerLabel.includes('0.5x') || lowerLabel.includes('0.5 x')) score -= 300;
      if (lowerLabel.includes('0.6x') || lowerLabel.includes('0.6 x')) score -= 300;
      if (lowerLabel.includes('wide-angle') || lowerLabel.includes('wide angle')) score -= 250;
      if (lowerLabel.includes('macro')) score -= 300;
      if (lowerLabel.includes('tele')) score -= 200;
      if (lowerLabel.includes('2x')) score -= 150;
      if (lowerLabel.includes('3x') || lowerLabel.includes('5x') || lowerLabel.includes('10x')) score -= 200;

      // ===== HEAVY PENALTY: Numbered cameras that aren't camera 0 =====
      // "camera 2", "camera 3", etc. are typically secondary lenses (ultra-wide, macro)
      const cameraNumMatch = lowerLabel.match(/camera\s*(\d+)/i);
      if (cameraNumMatch) {
        const camNum = parseInt(cameraNumMatch[1], 10);
        if (camNum === 0) {
          score += 150; // Camera 0 is usually main
        } else if (camNum === 1) {
          score += 50; // Camera 1 might be main on some devices
        } else {
          score -= camNum * 100; // Camera 2, 3... are almost always secondary
        }
      }

      // Samsung camera2 API patterns
      if (lowerLabel.includes('camera2 0')) score += 200;
      if (lowerLabel.includes('camera2 1')) score -= 100;
      if (lowerLabel.includes('camera2 2')) score -= 200;

      // "wide" (without ultra/angle) is often the main camera
      if (
        lowerLabel.includes('wide') &&
        !lowerLabel.includes('ultra') &&
        !lowerLabel.includes('wide-angle') &&
        !lowerLabel.includes('wide angle')
      ) {
        score += 80;
      }

      // Generic rear camera hints (lower priority)
      if (lowerLabel.includes('back 0') || lowerLabel.includes('rear 0')) score += 100;
      if (lowerLabel.includes('back camera') || lowerLabel.includes('rear camera')) score += 30;
      if (lowerLabel.includes('back') || lowerLabel.includes('rear') || lowerLabel.includes('facing back')) score += 15;

      // Slight preference for lower device enumeration order
      score -= index * 5;
      return score;
    };

    const scored = candidates.map((cam, idx) => {
      const hasTorch = cameraTorchCapability.get(cam.deviceId) || false;
      return { camera: cam, score: scoreCamera(cam.label, idx, hasTorch), hasTorch };
    });
    scored.sort((a, b) => b.score - a.score);

    console.log(
      '[QRScanner] Android camera scores:',
      scored.map((s) => ({
        label: s.camera.label,
        score: s.score,
        hasTorch: s.hasTorch,
        deviceId: s.camera.deviceId.slice(0, 8) + '...',
      }))
    );

    return scored.map((s) => s.camera);
  }, [videoDevices, isIOS, cameraTorchCapability]);

  // Selected camera device
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Safety net: if exact deviceId selection fails, retry with system default camera.
  const [useSystemDefaultCamera, setUseSystemDefaultCamera] = useState(false);

  // Check torch capability for all cameras on mount
  useEffect(() => {
    const checkTorchCapabilities = async () => {
      if (videoDevices.length === 0) return;
      
      const capabilities = new Map<string, boolean>();
      
      for (const device of videoDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: device.deviceId } }
          });
          
          const track = stream.getVideoTracks()[0];
          if (track) {
            const trackCapabilities = track.getCapabilities?.() as any;
            const hasTorch = trackCapabilities?.torch === true;
            capabilities.set(device.deviceId, hasTorch);
            
            if (hasTorch) {
              console.log('[QRScanner] 🔦 Torch supported on:', device.label);
            }
          }
          
          // Stop the stream after checking
          stream.getTracks().forEach(t => t.stop());
        } catch (e) {
          console.log('[QRScanner] Could not check torch for:', device.label);
          capabilities.set(device.deviceId, false);
        }
      }
      
      setCameraTorchCapability(capabilities);
    };
    
    checkTorchCapabilities();
  }, [videoDevices]);

  // Toggle torch on active stream
  const toggleTorch = useCallback(async () => {
    if (!activeStreamRef.current) {
      // Try to get the current video element's stream
      const videoEl = document.querySelector('#qr-reader video') as HTMLVideoElement;
      if (videoEl?.srcObject instanceof MediaStream) {
        activeStreamRef.current = videoEl.srcObject;
      }
    }
    
    if (!activeStreamRef.current) {
      console.log('[QRScanner] No active stream for torch');
      return;
    }
    
    const track = activeStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    
    const capabilities = track.getCapabilities?.() as any;
    if (!capabilities?.torch) {
      console.log('[QRScanner] Torch not supported on current camera');
      setTorchSupported(false);
      return;
    }
    
    try {
      const newTorchState = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: newTorchState } as any]
      });
      setTorchOn(newTorchState);
      console.log('[QRScanner] Torch:', newTorchState ? 'ON' : 'OFF');
    } catch (e) {
      console.error('[QRScanner] Failed to toggle torch:', e);
    }
  }, [torchOn]);

  // Check torch support when camera changes
  useEffect(() => {
    const checkCurrentCameraTorch = async () => {
      // Small delay to let the camera initialize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const videoEl = document.querySelector('#qr-reader video') as HTMLVideoElement;
      if (videoEl?.srcObject instanceof MediaStream) {
        activeStreamRef.current = videoEl.srcObject;
        const track = videoEl.srcObject.getVideoTracks()[0];
        if (track) {
          const capabilities = track.getCapabilities?.() as any;
          const hasTorch = capabilities?.torch === true;
          setTorchSupported(hasTorch);
          console.log('[QRScanner] Current camera torch support:', hasTorch);
          
          // Reset torch state when switching cameras
          if (!hasTorch) {
            setTorchOn(false);
          }
        }
      }
    };
    
    if (cameraReady && selectedDeviceId) {
      checkCurrentCameraTorch();
    }
  }, [cameraReady, selectedDeviceId]);

  // Auto-select best camera. Use automatic scoring for 1x Main camera.
  useEffect(() => {
    // Wait for devices to be enumerated (labels only available after permission granted)
    if (videoDevices.length === 0) {
      // Request camera permission to get device labels
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
        })
        .catch((e) => {
          console.error('[QRScanner] Permission request failed:', e);
        });
      return;
    }

    // iOS: use facingMode, no need to select specific device
    if (isIOS) {
      console.log('[QRScanner] iOS detected, using facingMode');
      setSetupChecked(true);
      setCameraReady(true);
      return;
    }

    setSetupChecked(true);

    // Android/Desktop: automatically select the best-scored camera (1x Main)
    if (rearCameras.length > 0) {
      const currentValid = selectedDeviceId && rearCameras.some((d) => d.deviceId === selectedDeviceId);
      
      if (!currentValid) {
        // Use best-scored camera (rearCameras[0] is already sorted by score)
        const bestCamera = rearCameras[0];
        console.log('[QRScanner] ✅ Auto-selecting 1x Main camera:', bestCamera.label);
        setSelectedDeviceId(bestCamera.deviceId);
        // Save the label for reference
        setCameraPreference(bestCamera.label);
      }
      setCameraReady(true);
    } else if (videoDevices.length > 0) {
      // Fallback: no rear cameras detected, use first available
      console.log('[QRScanner] No rear cameras, using first available:', videoDevices[0].label);
      setSelectedDeviceId(videoDevices[0].deviceId);
      setCameraReady(true);
    }
  }, [isIOS, rearCameras, selectedDeviceId, videoDevices, setupChecked]);
  
  // Handle camera switch - cycle through available cameras
  const handleCameraSwitch = useCallback((selectedId: string, selectedLabel: string) => {
    console.log('[QRScanner] Camera switched. DeviceId:', selectedId, 'Label:', selectedLabel);
    setSelectedDeviceId(selectedId);
    setCameraPreference(selectedLabel);
    setUseSystemDefaultCamera(false);
  }, []);

  // Get the currently selected camera label for display
  const selectedCameraLabel = useMemo(() => {
    if (!selectedDeviceId) return null;
    const cam = rearCameras.find(d => d.deviceId === selectedDeviceId);
    return cam?.label || 'Unknown Camera';
  }, [selectedDeviceId, rearCameras]);

  // Cycle to next rear camera (manual backup)
  const switchCamera = useCallback(() => {
    if (rearCameras.length <= 1) return;
    const currentIndex = rearCameras.findIndex((d) => d.deviceId === selectedDeviceId);
    const safeIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = (safeIndex + 1) % rearCameras.length;
    const nextCamera = rearCameras[nextIndex];

    // If we were in fallback mode, let the user force a specific camera again.
    setUseSystemDefaultCamera(false);

    setSelectedDeviceId(nextCamera.deviceId);
    // Save the LABEL (not deviceId) for persistence across sessions
    setCameraPreference(nextCamera.label);
    console.log('[QRScanner] Switched camera, saved label:', nextCamera.label);
  }, [rearCameras, selectedDeviceId]);

  // Build track constraints for the library (expects MediaTrackConstraints, not full MediaStreamConstraints)
  const videoConstraints = useMemo<MediaTrackConstraints>(() => {
    // Safety net: system default camera (no deviceId). Keep constraints minimal.
    if (useSystemDefaultCamera) {
      console.log('[QRScanner] Using system default camera (fallback)');
      return { facingMode: 'environment' };
    }

    // iOS: let Apple manage lens switching via facingMode
    if (isIOS) {
      console.log('[QRScanner] iOS: using facingMode environment');
      return {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };
    }

    // Android/Desktop: force best camera by deviceId (1080p ideal; avoid 4K)
    const constraints: MediaTrackConstraints = {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 30 },
    };

    if (selectedDeviceId) {
      console.log('[QRScanner] Android: using deviceId', selectedDeviceId.slice(0, 8) + '...');
      constraints.deviceId = { exact: selectedDeviceId };
    } else if (rearCameras.length > 0) {
      console.log('[QRScanner] Android: using first rear camera', rearCameras[0].label);
      constraints.deviceId = { exact: rearCameras[0].deviceId };
    } else {
      console.log('[QRScanner] Android: no cameras, using facingMode');
      constraints.facingMode = 'environment';
    }

    return constraints;
  }, [isIOS, rearCameras, selectedDeviceId, useSystemDefaultCamera]);

  const handleSuccessfulScan = useCallback(
    (decodedText: string) => {
      console.log('[QRScanner] Successful scan, raw text:', decodedText);

      setScanSuccess(true);

      // Vibrate on successful scan
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 100]);
      }

      // Play scan sound
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1200;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.08);
      } catch {}

      // Validate it's a valid string before passing
      if (!decodedText || typeof decodedText !== 'string') {
        console.error('[QRScanner] Invalid decoded text:', decodedText);
        setScanSuccess(false);
        return;
      }

      // Try to parse to validate
      const parsed = parseQRData(decodedText);
      console.log('[QRScanner] Parsed QR data:', parsed);

      // Pass the raw data to parent
      onScan(decodedText);
    },
    [onScan]
  );

  const handleScanResult = useCallback(
    (detectedCodes: IDetectedBarcode[]) => {
      if (detectedCodes.length > 0 && !scanSuccess) {
        const code = detectedCodes[0];
        handleSuccessfulScan(code.rawValue);
      }
    },
    [handleSuccessfulScan, scanSuccess]
  );

  const handleScanError = useCallback(
    (err: unknown) => {
      // Most errors are just "no QR found in frame" which is normal.
      if (!(err instanceof Error)) return;

      const msg = err.message || '';
      const name = (err as any).name as string | undefined;

      // If our Android exact-device strategy fails to start the camera, clear preference and re-prompt
      const isStartFailure =
        name === 'OverconstrainedError' ||
        name === 'NotReadableError' ||
        name === 'AbortError' ||
        msg.includes('Overconstrained') ||
        msg.includes('NotReadable') ||
        msg.includes('not readable');

      if (!isIOS && !useSystemDefaultCamera && isStartFailure) {
        console.error('[QRScanner] Camera start error - trying next camera:', err);
        
        // Try the next camera in the list
        if (rearCameras.length > 1) {
          const currentIndex = rearCameras.findIndex((d) => d.deviceId === selectedDeviceId);
          const nextIndex = (currentIndex + 1) % rearCameras.length;
          const nextCamera = rearCameras[nextIndex];
          setSelectedDeviceId(nextCamera.deviceId);
          setCameraPreference(nextCamera.label);
          console.log('[QRScanner] Switching to next camera:', nextCamera.label);
        } else {
          // Fall back to system default
          setUseSystemDefaultCamera(true);
        }
        return;
      }

      if (msg.includes('Permission') || msg.includes('denied')) {
        setError('Camera access denied. Please allow camera access in your browser settings.');
      } else if (msg.includes('NotFound') || msg.includes('not found')) {
        setError('No camera found on this device.');
      } else if (msg.includes('NotReadable') || msg.includes('in use')) {
        setError('Camera is in use by another application.');
      }
    },
    [isIOS, useSystemDefaultCamera]
  );

  const decodeQrFromImageFile = useCallback(
    async (file: File) => {
      setIsDecodingImage(true);
      setError(null);

      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not read image');

        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (!code?.data) return;

        handleSuccessfulScan(code.data);
      } catch (e) {
        console.error('[QRScanner] Failed to decode uploaded image:', e);
      } finally {
        setIsDecodingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [handleSuccessfulScan]
  );

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPasteValue(text);
    } catch {}
  };

  const handlePasteSubmit = () => {
    if (pasteValue.trim()) {
      handleSuccessfulScan(pasteValue.trim());
    }
  };

  const hasMultipleCameras = rearCameras.length > 1;

  return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-base-black flex flex-col"
      >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex flex-col items-center text-center">
        <h2 className="text-lg font-semibold text-white">Scan QR Code</h2>
      </div>
      
      {/* Close & Flash buttons */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <div className="flex items-center gap-2">
          {/* Flash/Torch Toggle - only show when supported */}
          {torchSupported && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleTorch}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                torchOn 
                  ? 'bg-yellow-400 text-black' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {torchOn ? (
                <Flashlight className="w-5 h-5" />
              ) : (
                <FlashlightOff className="w-5 h-5" />
              )}
            </motion.button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full">
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Scanner Container */}
      <div className="flex-1 relative flex items-center justify-center px-4 pt-24 pb-44">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center z-10 p-6">
            <div className="text-center text-white max-w-sm">
              <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-lg font-medium mb-2">Camera Error</p>
              <p className="text-sm opacity-70 mb-6">{error}</p>
              <Button
                onClick={() => {
                  setError(null);
                }}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          </div>
        ) : !cameraReady ? (
          // Show loading while waiting for camera to be selected
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm opacity-70">Initializing main camera...</p>
            </div>
          </div>
        ) : (
          <>
            {/* 1x Main Camera Prompt - above the camera */}
            {!isIOS && hasMultipleCameras && (
              <div className="absolute top-16 left-0 right-0 flex flex-col items-center z-10 px-4">
                <p className="text-xl font-bold text-white text-center mb-3">
                  Switch to <span className="font-black uppercase tracking-wide">Main</span> Camera
                </p>
                <motion.button
                  onClick={switchCamera}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/40 backdrop-blur-sm"
                >
                  <span className="text-sm text-white font-medium">
                    {selectedCameraLabel 
                      ? `📷 ${selectedCameraLabel.includes('0') || selectedCameraLabel.toLowerCase().includes('main') ? '1x Main' : selectedCameraLabel}`
                      : '📷 Detecting...'
                    }
                  </span>
                  {torchSupported && (
                    <span className="text-[10px] text-yellow-400">🔦</span>
                  )}
                  <motion.div
                    animate={{ x: [0, 3, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <SwitchCamera className="w-4 h-4 text-white/70" />
                  </motion.div>
                </motion.button>
              </div>
            )}
            
            {/* iOS or single camera - simple label */}
            {(isIOS || !hasMultipleCameras) && (
              <div className="absolute top-20 left-0 right-0 flex justify-center z-10">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm">
                  <span className="text-xs text-white/80 font-medium">
                    {isIOS ? '📷 iOS Auto' : '📷 Camera'}
                  </span>
                </div>
              </div>
            )}
            
            {/* Locked aspect viewport (prevents stretching + improves detection reliability) */}
            <div className="w-full max-w-md aspect-square rounded-3xl overflow-hidden bg-black/20 ring-1 ring-white/10 shadow-2xl">
              <Scanner
                key={useSystemDefaultCamera ? 'fallback' : (selectedDeviceId || 'ios-default')}
                onScan={handleScanResult}
                onError={handleScanError}
                constraints={videoConstraints}
                formats={['qr_code']}
                components={{ finder: true }}
                scanDelay={100}
                styles={{
                  container: { height: '100%', width: '100%' },
                  video: { width: '100%', height: '100%', objectFit: 'cover' },
                }}
              />
            </div>

            {/* Success overlay */}
            <AnimatePresence>
              {scanSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 z-20"
                >
                  <div className="w-24 h-24 rounded-full bg-green-500/30 flex items-center justify-center">
                    <Check className="w-12 h-12 text-green-400" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3 z-10">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) decodeQrFromImageFile(file);
          }}
        />

        <Button
          variant="ghost"
          disabled={isDecodingImage}
          onClick={() => fileInputRef.current?.click()}
          className="w-full text-white hover:text-white hover:bg-white/10 gap-2"
        >
          {isDecodingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageUp className="w-4 h-4" />}
          Upload QR Image
        </Button>

        {/* Paste Code Section */}
        {showPasteInput ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 space-y-3"
          >
            <div className="flex gap-2">
              <Input
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                placeholder="Paste QR code data..."
                className="bg-white/20 border-white/30 text-white placeholder:text-white/50"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePaste}
                className="text-white hover:bg-white/20 shrink-0"
              >
                <ClipboardPaste className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowPasteInput(false);
                  setPasteValue('');
                }}
                className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button onClick={handlePasteSubmit} className="flex-1 bg-base-blue hover:bg-base-blue/90">
                Submit
              </Button>
            </div>
          </motion.div>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setShowPasteInput(true)}
            className="w-full text-white/70 hover:text-white hover:bg-white/10 gap-2"
          >
            <ClipboardPaste className="w-4 h-4" />
            Paste Code Instead
          </Button>
        )}
      </div>
      </motion.div>
  );
}
