import { Buffer } from 'buffer';
import { PublicKey } from '@solana/web3.js';

import { LENDY_ID } from '../const';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const SEEDS = {
  USER_SEED: Buffer.from('MONEY_LENDER_USER'),
  PAIR_SEED: Buffer.from('PAIR'),
  OFFER_SEED: Buffer.from('OFFER'),
  LOAN_SEED: Buffer.from('LOAN'),
  ESCROW_SEED: Buffer.from('ESCROW'),

  AUTHORITY_SEED: Buffer.from('AUTHORITY'),
  UNWRAP_SEED: Buffer.from('UNWRAP'),
};

export const findUser = function (authority: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [authority.toBuffer(), SEEDS.USER_SEED],
    LENDY_ID,
  );
};

export const findLoan = function (
  clientLoanUuidBuffer: Buffer,
  borrower: PublicKey,
) {
  return PublicKey.findProgramAddressSync(
    [clientLoanUuidBuffer, borrower.toBuffer(), SEEDS.LOAN_SEED],
    LENDY_ID,
  );
};

export const findOffer = function (clientOfferUuid: Buffer, lender: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [clientOfferUuid, lender.toBuffer(), SEEDS.OFFER_SEED],
    LENDY_ID,
  );
};

export const findTokenWallet = function (user: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [user.toBuffer(), mint.toBuffer()],
    LENDY_ID,
  );
};

export const findEscrowWallet = function (loanKey: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [loanKey.toBuffer(), SEEDS.ESCROW_SEED],
    LENDY_ID,
  );
};

export const findProgramAuthority = function () {
  return PublicKey.findProgramAddressSync([SEEDS.AUTHORITY_SEED], LENDY_ID);
};

export const findAssociatedTokenAddress = function (
  owner: PublicKey,
  mint: PublicKey,
) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
};

export const findUnwrapWallet = function () {
  return PublicKey.findProgramAddressSync([SEEDS.UNWRAP_SEED], LENDY_ID);
};
