import { blob, struct } from '@solana/buffer-layout';
import { u64 } from '@solana/buffer-layout-utils';

export interface SplitLoanByPrincipalParams {
  new_loan_principal: bigint;
  client_loan_id: Uint8Array;
}

export const splitLoanByPrincipalLayout = struct<SplitLoanByPrincipalParams>([
  u64('new_loan_principal'),
  blob(16, 'client_loan_id'),
]);
