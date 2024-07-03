import { PublicKey } from '@solana/web3.js';
import { blob, struct, u8, u32, u16 } from '@solana/buffer-layout';
import { publicKey, u64 } from '@solana/buffer-layout-utils';
import { Buffer } from 'buffer';

const MAX_PAIR_SYMBOL_LENGTH = 22;

export interface Pair {
  discriminator: Uint8Array;
  version: number;
  enabled: number;
  symbol: Uint8Array;
  apr_bps: number;
  fee_rate_bps: number;
  duration_sec: bigint;
  principal_mint: PublicKey;
  collateral_mint: PublicKey;
  collateral_fee_receiver: PublicKey;
  min_offer_principal: bigint;
  principal_fee_receiver: PublicKey;
  min_auto_ltv_range_bps: number;
  offers_mgmt_fee_rate_bps: number;
}

export const PairLayout = struct<Pair>([
  blob(8, 'discriminator'),

  u8('version'),
  u8('enabled'),
  blob(MAX_PAIR_SYMBOL_LENGTH, 'symbol'),

  u32('apr_bps'),
  u32('fee_rate_bps'),
  u64('duration_sec'),

  publicKey('principal_mint'),
  publicKey('collateral_mint'),
  publicKey('collateral_fee_receiver'),
  u64('min_offer_principal'),
  publicKey('principal_fee_receiver'),
  u16('min_auto_ltv_range_bps'),
  u16('offers_mgmt_fee_rate_bps'),

  blob(32 * 4, '_padding'),
]);

export function decodePairLayout(data: Buffer) {
  return PairLayout.decode(data);
}
