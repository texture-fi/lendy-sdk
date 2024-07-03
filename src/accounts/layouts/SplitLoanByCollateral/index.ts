import { blob, struct } from '@solana/buffer-layout';
import { u64 } from '@solana/buffer-layout-utils';

export interface SplitLoanByCollateralParams {
  new_loan_collateral: bigint;
  client_loan_id: Uint8Array;
}

export const splitLoanByCollateralLayout = struct<SplitLoanByCollateralParams>([
  u64('new_loan_collateral'),
  blob(16, 'client_loan_id'),
]);
