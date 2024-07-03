import { struct } from '@solana/buffer-layout';
import { u64 } from '@solana/buffer-layout-utils';

export interface DepositParams {
  amount: BigInt;
}

export const depositParamsLayout = struct<DepositParams>([u64('amount')]);
