import { blob, struct } from '@solana/buffer-layout';

export interface ExtendParams {
  bulk_uuid: Uint8Array;
  client_loan_id: Uint8Array;
}

export const extendParamsLayout = struct<ExtendParams>([
  blob(16, 'bulk_uuid'),
  blob(16, 'client_loan_id'),
]);
