import { struct } from '@solana/buffer-layout';
import { u64 } from '@solana/buffer-layout-utils';

export interface WithdrawTokenParams {
  amount: BigInt;
}

export const withdrawTokenParamsLayout = struct<WithdrawTokenParams>([
  u64('amount'),
]);
