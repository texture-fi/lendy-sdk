import {
  Connection,
  PublicKey,
  TransactionInstruction,
  AccountMeta,
  SystemProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Buffer } from 'buffer';

import { Accounts } from './accounts';
import { LENDY_ID } from './const';
import { LendyInstruction } from './instructions/ids';
import {
  findAssociatedTokenAddress,
  findEscrowWallet,
  findLoan,
  findOffer,
  findProgramAuthority,
  findTokenWallet,
  findUnwrapWallet,
  findUser,
} from './pda';
import {
  User,
  USER_NICK_MAX_LEN,
  UserParamsLayout,
} from './accounts/layouts/User/user';
import { OfferParamsLayout } from './accounts/layouts/Offer';
import { Pair } from './accounts/layouts/Pair';
import { borrowParamsLayout } from './accounts/layouts/Borrow';
import { depositParamsLayout } from './accounts/layouts/Deposit';
import { withdrawTokenParamsLayout } from './accounts/layouts/WithdrawToken';
import { extendParamsLayout } from './accounts/layouts/Extend';
import { splitLoanByPrincipalLayout } from './accounts/layouts/SplitLoanByPrincipal';
import { splitLoanByCollateralLayout } from './accounts/layouts/SplitLoanByCollateral';
import { setLtvRangeParamsLayout } from './accounts/layouts/SetLtvRange';

export class Lendy {
  public readonly accounts: Accounts;

  constructor(
    public readonly connection: Connection,
    public readonly auth: PublicKey,
  ) {
    this.accounts = new Accounts(connection);
  }

  async createUser(nick: string, owner = this.auth) {
    if (nick.length > USER_NICK_MAX_LEN)
      throw new Error(`Max nick length is ${USER_NICK_MAX_LEN}.`);
    const [newUserKey] = findUser(owner);

    const keys: AccountMeta[] = [
      Lendy.meta(newUserKey, true, false),
      Lendy.meta(owner, true, true),
      Lendy.meta(SystemProgram.programId, false, false),
    ];

    const buffer = Buffer.alloc(UserParamsLayout.span);
    const nickBuffer = Buffer.alloc(USER_NICK_MAX_LEN);
    nickBuffer.write(nick);
    UserParamsLayout.encode(
      {
        nick: nickBuffer,
      },
      buffer,
    );
    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.CreateUser, ...buffer]),
    });
  }

  async makeOffer(
    pair: PublicKey,
    principal: number,
    collateral: number,
    clientOfferUuidBuffer: Buffer,
  ) {
    const [lenderKey] = findUser(this.auth);
    const [offerKey] = findOffer(clientOfferUuidBuffer, lenderKey);

    const keys: AccountMeta[] = [
      Lendy.meta(offerKey, true, false),
      Lendy.meta(lenderKey, true, false),
      Lendy.meta(this.auth, false, true),
      Lendy.meta(pair, false, false),
      Lendy.meta(SystemProgram.programId, false, false),
    ];

    const buffer = Buffer.alloc(OfferParamsLayout.span);

    OfferParamsLayout.encode(
      {
        client_offer_id: clientOfferUuidBuffer,
        principal: BigInt(principal),
        collateral: BigInt(collateral),
      },
      buffer,
    );
    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.MakeOffer, ...buffer]),
    });
  }

  async borrow(
    offerKey: PublicKey,
    principalAmount: number,
    bulkUuid: Buffer,
    clientLoanUuidBuffer: Buffer,
  ) {
    const [borrowerAccKey] = findUser(this.auth);
    const offer = await this.accounts.offer(offerKey);

    const [loanKey] = findLoan(clientLoanUuidBuffer, borrowerAccKey);

    const [lender, pair] = (await this.accounts.getMultipleAccounts([
      { accountType: 'user', pubkey: offer.lender },
      { accountType: 'pair', pubkey: offer.pair },
    ])) as [User, Pair];
    const [lenderAccKey] = findUser(lender.owner);
    const [sourcePrincipalWallet] = findTokenWallet(
      offer.lender,
      pair.principal_mint,
    );
    const [escrowWallet] = findEscrowWallet(loanKey);
    const [programAuthority] = findProgramAuthority();
    const borrowerCollateralWallet = getAssociatedTokenAddressSync(
      pair.collateral_mint,
      this.auth,
    );
    const borrowerPrincipalWallet = getAssociatedTokenAddressSync(
      pair.principal_mint,
      this.auth,
    );

    const keys: AccountMeta[] = [
      Lendy.meta(offerKey, true, false),
      Lendy.meta(loanKey, true, false),
      Lendy.meta(lenderAccKey, true, false),
      Lendy.meta(lender.owner, true, false),
      Lendy.meta(borrowerAccKey, true, false),
      Lendy.meta(this.auth, true, true),
      Lendy.meta(borrowerCollateralWallet, true, false),
      Lendy.meta(borrowerPrincipalWallet, true, false),
      Lendy.meta(sourcePrincipalWallet, true, false),
      Lendy.meta(escrowWallet, true, false),
      Lendy.meta(pair.collateral_fee_receiver, true, false),
      Lendy.meta(offer.pair, false, false),
      Lendy.meta(pair.collateral_mint, false, false),
      Lendy.meta(programAuthority, false, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
      Lendy.meta(SystemProgram.programId, false, false),
    ];
    console.log(keys.map(({ pubkey }) => pubkey.toString()));

    const buffer = Buffer.alloc(borrowParamsLayout.span);

    borrowParamsLayout.encode(
      {
        principal_amount: BigInt(principalAmount),
        bulk_uuid: bulkUuid,
        client_loan_id: clientLoanUuidBuffer,
      },
      buffer,
    );

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.Borrow, ...buffer]),
    });
  }

  async setupTokenWallet(mint: PublicKey) {
    const [userAccKey] = findUser(this.auth);
    const [walletToCreate] = findTokenWallet(userAccKey, mint);
    const [programAuthority] = findProgramAuthority();

    const keys: AccountMeta[] = [
      Lendy.meta(userAccKey, false, false),
      Lendy.meta(this.auth, true, true),
      Lendy.meta(walletToCreate, true, false),
      Lendy.meta(programAuthority, false, false),
      Lendy.meta(mint, false, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
      Lendy.meta(SystemProgram.programId, false, false),
    ];

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.SetupTokenWallet]),
    });
  }

  async depositToken(mint: PublicKey, amount: number) {
    const [userAccKey] = findUser(this.auth);
    const [sourceWallet] = findAssociatedTokenAddress(this.auth, mint);
    const [targetWallet] = findTokenWallet(userAccKey, mint);

    const keys: AccountMeta[] = [
      Lendy.meta(userAccKey, true, false),
      Lendy.meta(this.auth, false, true),
      Lendy.meta(sourceWallet, true, false),
      Lendy.meta(targetWallet, true, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
    ];
    console.log(keys.map(({ pubkey }) => pubkey.toString()));

    const buffer = Buffer.alloc(depositParamsLayout.span);

    depositParamsLayout.encode(
      {
        amount: BigInt(amount),
      },
      buffer,
    );

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.DepositToken, ...buffer]),
    });
  }

  async withdrawToken(mint: PublicKey, amount: number) {
    const [userAccKey] = findUser(this.auth);
    const [sourceWallet] = findTokenWallet(userAccKey, mint);
    const [targetWallet] = findAssociatedTokenAddress(this.auth, mint);

    const keys: AccountMeta[] = [
      Lendy.meta(userAccKey, true, false),
      Lendy.meta(this.auth, false, true),
      Lendy.meta(sourceWallet, true, false),
      Lendy.meta(targetWallet, true, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
    ];
    console.log(keys.map(({ pubkey }) => pubkey.toString()));

    const buffer = Buffer.alloc(withdrawTokenParamsLayout.span);

    withdrawTokenParamsLayout.encode(
      {
        amount: BigInt(amount),
      },
      buffer,
    );

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.WithdrawToken, ...buffer]),
    });
  }

  async claim(loan: PublicKey) {
    const loanAccount = await this.accounts.loan(loan);
    const [borrowerAccount, pairAccount] = await Promise.all([
      this.accounts.user(loanAccount.borrower),
      this.accounts.pair(loanAccount.pair),
    ]);

    const [lenderAccKey] = findUser(this.auth);
    const [escrowWallet] = findEscrowWallet(loan);
    const [programAuthority] = findProgramAuthority();
    const [lenderCollateralWallet] = findAssociatedTokenAddress(
      this.auth,
      pairAccount.collateral_mint,
    );

    const keys: AccountMeta[] = [
      Lendy.meta(loan, true, false),
      Lendy.meta(lenderAccKey, true, false),
      Lendy.meta(loanAccount.borrower, true, false),
      Lendy.meta(borrowerAccount.owner, true, false),
      Lendy.meta(this.auth, false, true),
      Lendy.meta(lenderCollateralWallet, true, false),
      Lendy.meta(escrowWallet, true, false),
      Lendy.meta(programAuthority, false, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
    ];
    console.log(keys.map(({ pubkey }) => pubkey.toString()));

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.Claim]),
    });
  }

  async cancelOffer(offer: PublicKey) {
    const [lenderAccKey] = findUser(this.auth);

    const keys: AccountMeta[] = [
      Lendy.meta(offer, true, false),
      Lendy.meta(lenderAccKey, true, false),
      Lendy.meta(this.auth, false, true),
    ];
    console.log(keys.map(({ pubkey }) => pubkey.toString()));

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.CancelOffer]),
    });
  }

  async repay(loanKey: PublicKey, pairKey: PublicKey) {
    const loan = await this.accounts.loan(loanKey);
    const lender = await this.accounts.user(loan.lender);
    const [borrowerAccKey] = findUser(this.auth);
    const [escrowWallet] = findEscrowWallet(loanKey);
    const [programAuthority] = findProgramAuthority();

    const pair = await this.accounts.pair(pairKey);

    const borrowerCollateralWallet = getAssociatedTokenAddressSync(
      pair.collateral_mint,
      this.auth,
    );
    const borrowerPrincipalWallet = getAssociatedTokenAddressSync(
      pair.principal_mint,
      this.auth,
    );
    const lenderPrincipalWallet = getAssociatedTokenAddressSync(
      pair.principal_mint,
      lender.owner,
      true,
    );

    const keys: AccountMeta[] = [
      Lendy.meta(loanKey, true, false),
      Lendy.meta(loan.lender, true, false),
      Lendy.meta(borrowerAccKey, true, false),
      Lendy.meta(this.auth, false, true),
      Lendy.meta(borrowerPrincipalWallet, true, false),
      Lendy.meta(borrowerCollateralWallet, true, false),
      Lendy.meta(lenderPrincipalWallet, true, false),
      Lendy.meta(escrowWallet, true, false),
      Lendy.meta(programAuthority, false, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
    ];
    console.log(keys.map(({ pubkey }) => pubkey.toString()));

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.Repay]),
    });
  }

  async repay2(loanKey: PublicKey, pairKey: PublicKey) {
    const loan = await this.accounts.loan(loanKey);
    const lender = await this.accounts.user(loan.lender);
    const [borrowerAccKey] = findUser(this.auth);
    const [escrowWallet] = findEscrowWallet(loanKey);
    const [programAuthority] = findProgramAuthority();

    const pair = await this.accounts.pair(pairKey);

    const borrowerCollateralWallet = getAssociatedTokenAddressSync(
      pair.collateral_mint,
      this.auth,
    );
    const borrowerPrincipalWallet = getAssociatedTokenAddressSync(
      pair.principal_mint,
      this.auth,
    );
    const lenderPrincipalWallet = getAssociatedTokenAddressSync(
      pair.principal_mint,
      lender.owner,
      true,
    );

    const keys: AccountMeta[] = [
      Lendy.meta(loanKey, true, false),
      Lendy.meta(loan.lender, true, false),
      Lendy.meta(borrowerAccKey, true, false),
      Lendy.meta(this.auth, false, true),
      Lendy.meta(borrowerPrincipalWallet, true, false),
      Lendy.meta(borrowerCollateralWallet, true, false),
      Lendy.meta(lenderPrincipalWallet, true, false),
      Lendy.meta(escrowWallet, true, false),

      /// SPL wallet to receive Texture fees for automated offer adjustment.
      // principal_fee_receiver @writable,
      Lendy.meta(pair.principal_fee_receiver, true, false),

      Lendy.meta(pairKey, true, false),
      Lendy.meta(programAuthority, false, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
    ];
    console.log(keys.map(({ pubkey }) => pubkey.toString()));

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.Repay2]),
    });
  }

  async repaySol(loanKey: PublicKey, pairKey: PublicKey) {
    const loan = await this.accounts.loan(loanKey);
    const lender = await this.accounts.user(loan.lender);
    const [borrowerAccKey] = findUser(this.auth);
    const [escrowWallet] = findEscrowWallet(loanKey);
    const [programAuthority] = findProgramAuthority();

    const pair = await this.accounts.pair(pairKey);

    const borrowerCollateralWallet = getAssociatedTokenAddressSync(
      pair.collateral_mint,
      this.auth,
    );

    const keys: AccountMeta[] = [
      Lendy.meta(loanKey, true, false),
      Lendy.meta(loan.lender, true, false),
      Lendy.meta(lender.owner, true, false),
      Lendy.meta(borrowerAccKey, true, false),
      Lendy.meta(this.auth, false, true),
      Lendy.meta(borrowerCollateralWallet, true, false),
      Lendy.meta(escrowWallet, true, false),
      Lendy.meta(programAuthority, false, false),
      Lendy.meta(pairKey, false, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
      Lendy.meta(SystemProgram.programId, false, false),
    ];
    console.log(keys.map(({ pubkey }) => pubkey.toString()));

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.RepaySol]),
    });
  }

  async repaySol2(loanKey: PublicKey, pairKey: PublicKey) {
    const loan = await this.accounts.loan(loanKey);
    const lender = await this.accounts.user(loan.lender);
    const [borrowerAccKey] = findUser(this.auth);
    const [escrowWallet] = findEscrowWallet(loanKey);
    const [programAuthority] = findProgramAuthority();

    const pair = await this.accounts.pair(pairKey);

    const borrowerCollateralWallet = getAssociatedTokenAddressSync(
      pair.collateral_mint,
      this.auth,
    );

    const keys: AccountMeta[] = [
      Lendy.meta(loanKey, true, false),
      Lendy.meta(loan.lender, true, false),
      Lendy.meta(lender.owner, true, false),
      Lendy.meta(borrowerAccKey, true, false),
      Lendy.meta(this.auth, false, true),
      Lendy.meta(borrowerCollateralWallet, true, false),
      Lendy.meta(escrowWallet, true, false),

      /// SPL wallet to receive Texture fees for automated offer adjustment.
      // principal_fee_receiver @writable,
      Lendy.meta(pair.principal_fee_receiver, true, false),

      Lendy.meta(programAuthority, false, false),
      Lendy.meta(pairKey, false, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
      Lendy.meta(SystemProgram.programId, false, false),
    ];
    console.log(keys.map(({ pubkey }) => pubkey.toString()));

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.RepaySol2]),
    });
  }

  async setLtvRange(
    offer: PublicKey,
    pairKey: PublicKey,
    min_ltv_bps: number,
    max_ltv_bps: number,
  ) {
    const [lenderKey] = findUser(this.auth);

    const keys: AccountMeta[] = [
      /// Offer account to set LTV range for.
      // offer @writable [owner: self],
      Lendy.meta(offer, true, false),

      /// Lender's `User` account. NOT his private wallet!
      // lender [owner: self],
      Lendy.meta(lenderKey, true, false),

      /// Authority of that User account i.e. private lender's wallet
      // lender_authority @signer,
      Lendy.meta(this.auth, true, true),

      /// `Pair` account offer for.
      // pair [owner: self],
      Lendy.meta(pairKey, true, false),
    ];
    console.log(keys.map(({ pubkey }) => pubkey.toString()));

    const buffer = Buffer.alloc(setLtvRangeParamsLayout.span);
    setLtvRangeParamsLayout.encode(
      {
        min_ltv_bps,
        max_ltv_bps,
      },
      buffer,
    );

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.SetLtvRange, ...buffer]),
    });
  }

  async extendConstPrincipal(
    loanKey: PublicKey,
    offerKey: PublicKey,
    uuidBuffer: Buffer,
    clientLoanUuidBuffer: Buffer,
  ) {
    const [borrowerAccKey] = findUser(this.auth);

    const [offer, loan] = await Promise.all([
      this.accounts.offer(offerKey),
      this.accounts.loan(loanKey),
    ]);

    const [oldLender, newLender, pair] =
      (await this.accounts.getMultipleAccounts([
        { accountType: 'user', pubkey: loan.lender },
        { accountType: 'user', pubkey: offer.lender },
        { accountType: 'pair', pubkey: loan.pair },
      ])) as [User, User, Pair];

    const [oldLenderAccKey] = findUser(oldLender.owner);
    const [newLenderAccKey] = findUser(newLender.owner);

    const [programAuthority] = findProgramAuthority();

    const borrowerCollateralWallet = getAssociatedTokenAddressSync(
      pair.collateral_mint,
      this.auth,
    );

    const [oldEscrowWallet] = findEscrowWallet(loanKey);

    const [sourcePrincipalWallet] = findTokenWallet(
      offer.lender,
      pair.principal_mint,
    );

    const [newLoanKey] = findLoan(clientLoanUuidBuffer, borrowerAccKey);
    const [newEscrowWallet] = findEscrowWallet(newLoanKey);
    const [unwrapWallet] = findUnwrapWallet();

    const keys: AccountMeta[] = [
      Lendy.meta(loanKey, true, false),
      Lendy.meta(newLoanKey, true, false),
      Lendy.meta(offerKey, true, false),
      Lendy.meta(oldLenderAccKey, true, false),
      Lendy.meta(oldLender.owner, true, false),
      Lendy.meta(newLenderAccKey, true, false),
      Lendy.meta(newLender.owner, true, false),
      Lendy.meta(borrowerAccKey, true, false),
      Lendy.meta(this.auth, true, true),
      Lendy.meta(borrowerCollateralWallet, true, false),
      Lendy.meta(sourcePrincipalWallet, true, false),
      Lendy.meta(sourcePrincipalWallet, true, false),
      Lendy.meta(oldEscrowWallet, true, false),
      Lendy.meta(newEscrowWallet, true, false),
      Lendy.meta(pair.collateral_fee_receiver, true, false),
      Lendy.meta(pair.principal_fee_receiver, true, false),
      Lendy.meta(unwrapWallet, true, false),
      Lendy.meta(loan.pair, false, false),
      Lendy.meta(pair.collateral_mint, false, false),
      Lendy.meta(NATIVE_MINT, false, false),
      Lendy.meta(programAuthority, false, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
      Lendy.meta(SystemProgram.programId, false, false),
    ];

    const buffer = Buffer.alloc(extendParamsLayout.span);
    extendParamsLayout.encode(
      {
        bulk_uuid: uuidBuffer,
        client_loan_id: clientLoanUuidBuffer,
      },
      buffer,
    );

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.ExtendConstPrincipal, ...buffer]),
    });
  }

  async version() {
    const keys: AccountMeta[] = [
      Lendy.meta(SystemProgram.programId, false, false),
    ];

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.Version]),
    });
  }

  async extendConstCollateral(
    loanKey: PublicKey,
    loanLender: PublicKey,
    loanPair: PublicKey,
    offerKey: PublicKey,
    uuidBuffer: Buffer,
    clientLoanUuidBuffer: Buffer,
  ) {
    const [borrowerAccKey] = findUser(this.auth);

    const offer = await this.accounts.offer(offerKey);

    const [oldLender, newLender, pair] =
      (await this.accounts.getMultipleAccounts([
        { accountType: 'user', pubkey: loanLender },
        { accountType: 'user', pubkey: offer.lender },
        { accountType: 'pair', pubkey: loanPair },
      ])) as [User, User, Pair];

    const [oldLenderAccKey] = findUser(oldLender.owner);
    const [newLenderAccKey] = findUser(newLender.owner);

    const [programAuthority] = findProgramAuthority();

    const borrowerCollateralWallet = getAssociatedTokenAddressSync(
      pair.collateral_mint,
      this.auth,
    );

    const borrowerPrincipalWallet = getAssociatedTokenAddressSync(
      pair.principal_mint,
      this.auth,
    );

    const lenderPrincipalWallet = pair.principal_mint.equals(NATIVE_MINT)
      ? oldLender.owner
      : getAssociatedTokenAddressSync(pair.principal_mint, oldLender.owner);

    const [oldEscrowWallet] = findEscrowWallet(loanKey);

    const [sourcePrincipalWallet] = findTokenWallet(
      offer.lender,
      pair.principal_mint,
    );

    const [newLoanKey] = findLoan(clientLoanUuidBuffer, borrowerAccKey);
    const [newEscrowWallet] = findEscrowWallet(newLoanKey);
    const [unwrapWallet] = findUnwrapWallet();

    const keys: AccountMeta[] = [
      Lendy.meta(loanKey, true, false),
      Lendy.meta(newLoanKey, true, false),
      Lendy.meta(offerKey, true, false),
      Lendy.meta(oldLenderAccKey, true, false),
      Lendy.meta(oldLender.owner, true, false),
      Lendy.meta(newLenderAccKey, true, false),
      Lendy.meta(newLender.owner, true, false),
      Lendy.meta(borrowerAccKey, true, false),
      Lendy.meta(this.auth, true, true),
      Lendy.meta(borrowerCollateralWallet, true, false),
      Lendy.meta(borrowerPrincipalWallet, true, false),
      Lendy.meta(lenderPrincipalWallet, true, false),
      Lendy.meta(sourcePrincipalWallet, true, false),
      Lendy.meta(oldEscrowWallet, true, false),
      Lendy.meta(newEscrowWallet, true, false),
      Lendy.meta(pair.collateral_fee_receiver, true, false),
      Lendy.meta(pair.principal_fee_receiver, true, false),
      Lendy.meta(unwrapWallet, true, false),
      Lendy.meta(loanPair, false, false),
      Lendy.meta(pair.collateral_mint, false, false),
      Lendy.meta(NATIVE_MINT, false, false),
      Lendy.meta(programAuthority, false, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
      Lendy.meta(SystemProgram.programId, false, false),
    ];

    console.log(keys.map(({ pubkey }) => pubkey.toString()));

    const buffer = Buffer.alloc(extendParamsLayout.span);
    extendParamsLayout.encode(
      {
        bulk_uuid: uuidBuffer,
        client_loan_id: clientLoanUuidBuffer,
      },
      buffer,
    );

    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.ExtendConstCollateral, ...buffer]),
    });
  }

  async splitLoanByPrincipal(
    loanKey: PublicKey,
    clientLoanUuid: string,
    principal: bigint,
  ) {
    const clientLoanUuidBuffer = Buffer.alloc(16);
    clientLoanUuidBuffer.write(clientLoanUuid);
    const [expectedBorrower] = findUser(this.auth);
    const [newLoan] = findLoan(clientLoanUuidBuffer, expectedBorrower);

    const loan = await this.accounts.loan(loanKey);
    const pair = await this.accounts.pair(loan.pair);

    const [escrowWallet] = findEscrowWallet(loanKey);
    const [newEscrowWallet] = findEscrowWallet(newLoan);
    const [programAuthority] = findProgramAuthority();

    const keys: AccountMeta[] = [
      Lendy.meta(loanKey, true, false),
      Lendy.meta(newLoan, true, false),
      Lendy.meta(this.auth, true, true),
      Lendy.meta(escrowWallet, true, false),
      Lendy.meta(newEscrowWallet, true, false),
      Lendy.meta(loan.pair, false, false),
      Lendy.meta(pair.collateral_mint, false, false),
      Lendy.meta(programAuthority, false, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
      Lendy.meta(SystemProgram.programId, false, false),
    ];
    const buffer = Buffer.alloc(splitLoanByPrincipalLayout.span);

    splitLoanByPrincipalLayout.encode(
      {
        new_loan_principal: principal,
        client_loan_id: clientLoanUuidBuffer,
      },
      buffer,
    );
    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.SplitLoanByPrincipal, ...buffer]),
    });
  }

  async splitLoanByCollateral(
    loanKey: PublicKey,
    clientLoanUuidBuffer: Buffer,
    principal: bigint,
  ) {
    const [expectedBorrower] = findUser(this.auth);
    const [newLoan] = findLoan(clientLoanUuidBuffer, expectedBorrower);

    const loan = await this.accounts.loan(loanKey);
    const pair = await this.accounts.pair(loan.pair);

    const [escrowWallet] = findEscrowWallet(loanKey);
    const [newEscrowWallet] = findEscrowWallet(newLoan);
    const [programAuthority] = findProgramAuthority();

    const keys: AccountMeta[] = [
      Lendy.meta(loanKey, true, false),
      Lendy.meta(newLoan, true, false),
      Lendy.meta(this.auth, true, true),
      Lendy.meta(escrowWallet, true, false),
      Lendy.meta(newEscrowWallet, true, false),
      Lendy.meta(loan.pair, false, false),
      Lendy.meta(pair.collateral_mint, false, false),
      Lendy.meta(programAuthority, false, false),
      Lendy.meta(TOKEN_PROGRAM_ID, false, false),
      Lendy.meta(SystemProgram.programId, false, false),
    ];
    const buffer = Buffer.alloc(splitLoanByCollateralLayout.span);

    splitLoanByCollateralLayout.encode(
      {
        new_loan_collateral: principal,
        client_loan_id: clientLoanUuidBuffer,
      },
      buffer,
    );
    return new TransactionInstruction({
      keys,
      programId: LENDY_ID,
      data: Buffer.from([LendyInstruction.SplitLoanByCollateral, ...buffer]),
    });
  }

  private static meta(
    pubkey: PublicKey,
    isWritable: boolean,
    isSigner: boolean,
  ): AccountMeta {
    return {
      pubkey,
      isSigner,
      isWritable,
    };
  }
}
