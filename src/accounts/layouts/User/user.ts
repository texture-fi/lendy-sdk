import { PublicKey } from '@solana/web3.js';
import { blob, struct, u8, seq, Layout } from '@solana/buffer-layout';
import { publicKey, u64 } from '@solana/buffer-layout-utils';
import { Buffer } from 'buffer';

import { UserPairStats, UserPairStatsLayout } from './UserPairStats';

export const USER_NICK_MAX_LEN = 14;

export interface User {
  discriminator: Uint8Array;

  version: number;
  bump: number;
  nick: Uint8Array;

  owner: PublicKey;

  next_offer_seq_no: bigint;
  next_loan_seq_no: bigint;

  stats: UserPairStats[];
}

export const UserLayout = struct<User>([
  blob(8, 'discriminator'),
  u8('version'),
  u8('bump'),
  blob(USER_NICK_MAX_LEN, 'nick'),

  publicKey('owner'),

  u64('next_offer_seq_no'),
  u64('next_loan_seq_no'),

  seq(UserPairStatsLayout, 32, 'stats'),

  blob(32 * 10, '_padding_1'),
]);

export function decodeUserLayout(data: Buffer) {
  return UserLayout.decode(data);
}

export interface UserParams {
  nick: Uint8Array;
}

export const UserParamsLayout = struct<UserParams>([
  blob(USER_NICK_MAX_LEN, 'nick'),
]);
