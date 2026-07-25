// PayTag Registry - Ensures uniqueness of PayTags
// In a real app, this would be a backend check against a database

const REGISTRY_KEY = 'monipay_paytag_registry';

interface PayTagEntry {
  payTag: string;
  address: string;
  createdAt: number;
}

// Get all registered PayTags
export function getRegisteredPayTags(): PayTagEntry[] {
  const stored = localStorage.getItem(REGISTRY_KEY);
  return stored ? JSON.parse(stored) : [];
}

// Check if a PayTag is already taken
export function isPayTagTaken(payTag: string): boolean {
  const normalizedTag = payTag.toLowerCase().trim();
  const registry = getRegisteredPayTags();
  return registry.some(entry => entry.payTag.toLowerCase() === normalizedTag);
}

// Register a new PayTag
export function registerPayTag(payTag: string, address: string): boolean {
  const normalizedTag = payTag.toLowerCase().trim();
  const normalizedAddress = address.toLowerCase();
  
  if (isPayTagTaken(normalizedTag)) {
    return false;
  }
  
  const registry = getRegisteredPayTags();
  registry.push({
    payTag: normalizedTag,
    address: normalizedAddress,
    createdAt: Date.now(),
  });
  
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  return true;
}

// Get address for a PayTag (returns lowercase address)
export function getAddressForPayTag(payTag: string): string | null {
  const normalizedTag = payTag.toLowerCase().trim();
  const registry = getRegisteredPayTags();
  const entry = registry.find(e => e.payTag.toLowerCase() === normalizedTag);
  return entry?.address?.toLowerCase() || null;
}

// Remove a PayTag (for account deletion)
export function unregisterPayTag(payTag: string): void {
  const normalizedTag = payTag.toLowerCase().trim();
  const registry = getRegisteredPayTags();
  const filtered = registry.filter(e => e.payTag.toLowerCase() !== normalizedTag);
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(filtered));
}
