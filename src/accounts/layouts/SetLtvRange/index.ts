import { struct, u16 } from '@solana/buffer-layout';

export interface SetLtvRangeParams {
  min_ltv_bps: number;
  max_ltv_bps: number;
}

export const setLtvRangeParamsLayout = struct<SetLtvRangeParams>([
  u16('min_ltv_bps'),
  u16('max_ltv_bps'),
]);
