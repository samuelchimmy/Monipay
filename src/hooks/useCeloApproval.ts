/**
 * useCeloApproval.ts
 * Manages the USDT → MoniPayRouter approval state on Celo.
 *
 * Supports two modes:
 * 1. MiniPay context: uses window.ethereum (approveCeloUsdt)
 * 2. Normal app context: uses decrypted private key (approveCeloUsdtWithKey)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getCeloUsdtAllowance,
  approveCeloUsdt,
  approveCeloUsdtWithKey,
  usdtToRaw,
} from '@/lib/celoWallet';
import { ensureGasForApproval } from '@/lib/gasGuard';
import { toast } from 'sonner';

const MIN_SUFFICIENT_ALLOWANCE_USDT = 100;
