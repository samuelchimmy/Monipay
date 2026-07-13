/**
 * MoniPay Content Script
 * 
 * Injects the `window.monipay` API onto merchant pages by loading injected.js
 * into the page context, then bridges messages between the page and the
 * extension background script.
 */

// Inject the page-level API script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Listen for payment requests from the injected page script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'MONIPAY_REQUEST_PAYMENT') return;

  const { id, amount, merchant, merchantId, callbackUrl, metadata } = event.data;

  // Forward to background script
  chrome.runtime.sendMessage(
    {
      type: 'PAYMENT_REQUEST',
      payload: { id, amount, merchant, merchantId, callbackUrl, metadata },
    },
    (response) => {
      // Relay response back to the page
      window.postMessage(
        {
          type: 'MONIPAY_PAYMENT_RESPONSE',
          id,
          ...response,
        },
        '*'
      );
    }
  );
});
