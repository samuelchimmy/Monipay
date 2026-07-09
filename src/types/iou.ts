/**
 * IOU (I Owe You) Types
 *
 * Represents on-chain IOUs created when a recipient doesn't have
 * a MoniPay account yet. Funds are held until claimed or expired.
 */

export type IOUStatus = 'pending' | 'claimed' | 'expired' | 'refunded';

export interface IOU {
  id: string;
  iou_id: string;            // On-chain IOU ID
  recipient_id: string;      // keccak256(platform:userId) bytes32
  sender_profile_id: string; // FK to profiles
  recipient_profile_id?: string | null; // FK set on claim
  recipient_identifier: string; // Human-readable: "discord:username" or "@paytag"
  token: string;             // Token contract address
  amount: number;            // Human-readable amount
  chain: string;             // base | bsc | celo | tempo | ink
  status: IOUStatus;
  expiry: string;            // ISO timestamp
  claimed_at?: string | null;
  tx_hash_create?: string | null;
  tx_hash_claim?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IOUCreateParams {
  recipientIdentifier: string;
  amount: number;
  chain: string;
  token: string;
  platform: string;         // discord | telegram | twitter
  platformUserId: string;
}

export interface IOUClaimParams {
  iouId: string;
  claimantProfileId: string;
  claimantAddress: string;
}
