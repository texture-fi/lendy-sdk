import { PublicKey } from '@solana/web3.js';
import { blob, struct, u8 } from '@solana/buffer-layout';
import { publicKey, u64 } from '@solana/buffer-layout-utils';
import { Buffer } from 'buffer';

export interface Offer {
  discriminator: Uint8Array;

  version: number;

  pair: PublicKey;

  client_offer_id: Uint8Array;

  principal: bigint;
  collateral: bigint;

  remaining_principal: bigint;
  remaining_collateral: bigint;

  lender: PublicKey;
}

export const OfferLayout = struct<Offer>([
  blob(8, 'discriminator'),

  u8('version'),
  blob(7, '_padding0'),

  publicKey('pair'),

  blob(16, 'client_offer_id'),

  u64('principal'),
  u64('collateral'),

  u64('remaining_principal'),
  u64('remaining_collateral'),

  publicKey('lender'),

  blob(32 * 4, '_padding1'),
]);

export interface OfferParams {
  client_offer_id: Uint8Array;
  principal: bigint;
  collateral: bigint;
}

export const OfferParamsLayout = struct<OfferParams>([
  blob(16, 'client_offer_id'),
  u64('principal'),
  u64('collateral'),
]);

export function decodeOfferLayout(data: Buffer) {
  return OfferLayout.decode(data);
}
