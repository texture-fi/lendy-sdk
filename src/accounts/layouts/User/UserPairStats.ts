import { PublicKey } from '@solana/web3.js';
import { struct } from '@solana/buffer-layout';
import { publicKey, u64 } from '@solana/buffer-layout-utils';

export interface UserPairStats {
    pair: PublicKey,
    offered: bigint,
    borrowed: bigint,
    all_time_claimed: bigint,
    all_time_earned: bigint,

    owed: bigint,
    all_time_repaid: bigint,
    all_time_defaulted: bigint,
}

export const UserPairStatsLayout = struct<UserPairStats>([
    publicKey('pair'), // Statistics is for that specific pair

    // Lender stats
    u64('offered'), // in principal currency. see number of decimal places in respective mint.
    u64('borrowed'), // in principal currency
    u64('all_time_claimed'), // in collateral currency
    u64('all_time_earned'), // in principal currency

    // Borrower stats
    u64('owed'), // amount in princ. curr. User owe currently by its active loans
    u64('all_time_repaid'), // sum of all repayments
    u64('all_time_defaulted'), // amount in princ. curr. User not repaid
]);
