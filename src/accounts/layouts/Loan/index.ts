import { PublicKey } from '@solana/web3.js';
import { blob, struct, u32, u8 } from '@solana/buffer-layout';
import { publicKey, u64 } from '@solana/buffer-layout-utils';
import { Buffer } from 'buffer';

export interface Loan {
  discriminator: Uint8Array;

  version: number;
  bulk_uuid: Uint8Array;
  client_loan_id: Uint8Array;

  pair: PublicKey;
  apr_bps: number;
  principal: bigint;
  collateral: bigint;
  duration_sec: bigint;
  lender: PublicKey;

  start_time: bigint;
  end_time: bigint;
  borrower: PublicKey;
  status: number;
}

export const LoanLayout = struct<Loan>([
  blob(8, 'discriminator'),

  u8('version'),
  blob(7, '_padding0'),
  blob(16, 'bulk_uuid'),
  blob(16, 'client_loan_id'),
  blob(4, '_padding1'),

  publicKey('pair'),
  u32('apr_bps'),
  u64('principal'),
  u64('collateral'),
  u64('duration_sec'),
  publicKey('lender'),

  u64('start_time'),
  u64('end_time'),
  publicKey('borrower'),
  u8('status'),

  blob(32 * 4 * 7, '_padding2'),
]);

export function decodeLoanLayout(data: Buffer) {
  return LoanLayout.decode(data);
}
