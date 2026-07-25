// Centralized app configuration
// Update these values in one place to reflect changes across the app

export const APP_CONFIG = {
  // App Info
  name: "MoniPay",
  version: "1.0.0",
  tagline: "Gasless Payments on Celo",

  // Branding
  website: "https://monipay.xyz",
  paymentUrl: "https://monipay.xyz/pay", // Payment link base URL
  supportEmail: "support@monipay.xyz",

  // Chain Info
  chain: {
    name: "Celo",
    fullName: "Celo Mainnet",
    id: 42220,
    currency: "USDT",
  },

  // Fees
  platformFee: 0.01, // 1%

  // Social Links
  social: {
    twitter: "https://x.com/monipay_xyz",
    discord: "https://discord.gg/kSAwXzeRDB",
    telegram: "",
  },

  // Smart Contracts (Celo Mainnet)
  contracts: {
    // Main payment router for in-app EIP-712 signed transactions
    moniPayRouter: "0xd66C5E7177C4f6B6583a0B643381DcF7d88Bd2b0" as const,
    // MoniBot router for social/Twitter-triggered pre-approved transfers
    moniBotRouter: "0x2a6Ff7552F296A8C5e8688FbA32685E73e138B9e" as const,
    // USDT token on Celo Mainnet (MoniPay settlement token)
    usdc: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const,
    // Platform treasury for fee collection
    platformTreasury: "0xfa2B8eD012f756E22E780B772d604af4575d5fcf" as const,
  },
} as const;

// Google OAuth Client ID for Cloud Backup
// Replace with your actual Google Client ID from Google Cloud Console
export const GOOGLE_CLIENT_ID = "1094673182543-e2un3b4bce4vaj42n0tksoj5f8i9rd7a.apps.googleusercontent.com";

// Derived values
export const APP_VERSION_STRING = `${APP_CONFIG.name} v${APP_CONFIG.version}`;
export const APP_FOOTER_TEXT = `${APP_VERSION_STRING} • Built on ${APP_CONFIG.chain.name}`;
