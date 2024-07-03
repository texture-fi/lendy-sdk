import { blob, struct } from '@solana/buffer-layout';
import { u64 } from '@solana/buffer-layout-utils';

export interface BorrowParams {
  principal_amount: BigInt;
  bulk_uuid: Uint8Array;
  client_loan_id: Uint8Array;
}

export const borrowParamsLayout = struct<BorrowParams>([
  u64('principal_amount'),
  blob(16, 'bulk_uuid'),
  blob(16, 'client_loan_id'),
]);
