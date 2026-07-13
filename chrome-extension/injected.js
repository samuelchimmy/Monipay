/**
 * MoniPay Injected Script
 * 
 * This runs in the PAGE context (not extension context).
 * It exposes `window.monipay.requestPayment()` for merchant websites.
 */

(function () {
  if (window.monipay) return; // Already injected

  const pendingRequests = new Map();

  // Listen for responses from the content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== 'MONIPAY_PAYMENT_RESPONSE') return;

    const { id, success, txHash, error } = event.data;
    const pending = pendingRequests.get(id);
    if (!pending) return;

    pendingRequests.delete(id);

    if (success) {
      pending.resolve({ success: true, txHash });
    } else {
      pending.reject(new Error(error || 'Payment failed'));
    }
  });

  window.monipay = {
    /**
     * Request a payment from the user.
     * 
     * @param {Object} options
     * @param {number} options.amount - Payment amount in USDC
     * @param {string} options.merchant - Display name of the merchant
     * @param {string} [options.merchantId] - MoniPay merchant profile ID
     * @param {string} [options.callbackUrl] - URL to redirect after payment
     * @param {Object} [options.metadata] - Custom metadata for the order
     * @returns {Promise<{ success: boolean, txHash: string }>}
     */
    requestPayment({ amount, merchant, merchantId, callbackUrl, metadata } = {}) {
      return new Promise((resolve, reject) => {
        if (!amount || amount <= 0) {
          return reject(new Error('Invalid amount'));
        }
        if (!merchant) {
          return reject(new Error('Merchant name is required'));
        }

        const id = crypto.randomUUID();
        pendingRequests.set(id, { resolve, reject });

        // Post to content script
        window.postMessage(
          {
            type: 'MONIPAY_REQUEST_PAYMENT',
            id,
            amount,
            merchant,
            merchantId,
            callbackUrl,
            metadata,
          },
          '*'
        );

        // Timeout after 5 minutes
        setTimeout(() => {
          if (pendingRequests.has(id)) {
            pendingRequests.delete(id);
            reject(new Error('Payment request timed out'));
          }
        }, 5 * 60 * 1000);
      });
    },

    /** Check if MoniPay extension is installed */
    isAvailable: true,
    version: '1.0.0',
  };

  // Dispatch event so merchants can detect the extension
  window.dispatchEvent(new CustomEvent('monipay:ready'));
})();
