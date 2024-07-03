# Typescript SDK

## Make Offer

```tsx
import { PublicKey, Connection } from '@solana/web3.js';
import { Lendy, getUuid } from '@texture/lendy';

const connection = new Connection();
const walletPublicKey = new PublicKey(/* test key */);

const lendy = new Lendy(connection, walletPublicKey);

const offer = {
    principal: 49400000000,
    collateral: 1000000,
    pairPublicKey: new PublicKey('3VZpYYp2DnjTDRC1qfy8Y9KKgV7QVGfrkViLg1BuhKiZ'),
};

const instructions = [
    await lendy.makeOffer(
        offer.pairPublicKey,
        offer.principal,
        offer.collateral,
        getUuid(),
    );
];

// send transaction
```

Automated Bot-Managed Offer with LTV Range

```tsx
import { PublicKey, Connection } from '@solana/web3.js';
import { Lendy, findUser, findOffer, getUuid, getOfferKey } from '@texture/lendy';

const pairPublicKey = new PublicKey('3VZpYYp2DnjTDRC1qfy8Y9KKgV7QVGfrkViLg1BuhKiZ');
const walletPublicKey = new PublicKey(/* test key */);

const connection = new Connection();
const lendy = new Lendy(connection, walletPublicKey);

const offer = {
    principal: 49400000000,
    collateral: 1000000,
    pairPublicKey,
    minLtvBps: 7000,
    maxLtvBps: 7300,
};

const clientOfferUuid = getUuid();
const instructions = [];
instructions.push(
    (await lendy.makeOffer(
        offer.pairPublicKey,
        offer.principal,
        offer.collateral,
        clientOfferUuid,
    ));
);

const offerKey = getOfferKey(walletPublicKey, clientOfferUuid);

const setLtvRangeIx = await lendy.setLtvRange(
  offerKey,
  offer.pairPublicKey,
  offer.minLtvBps,
  offer.maxLtvBps,
);

instructions.push(setLtvRangeIx);

// send transaction
```

## Cancel Offer

```tsx
import { PublicKey, Connection } from '@solana/web3.js';
import { Lendy } from '@texture/lendy';

const walletPublicKey = new PublicKey(/* test key */);
const offerPublicKey = new PublicKey(/* test key */);

const connection = new Connection();
const lendy = new Lendy(connection, walletPublicKey);

const instructions = [
    (await lendy.cancelOffer(offerPublicKey))
];

// send transaction
```

## **Borrow**

We need to ensure that a User account for the Borrower exists.

```tsx
import { PublicKey, Connection } from '@solana/web3.js';
import { findUser, Lendy } from '@caryatid/lendy-sdk';

const walletPublicKey = new PublicKey(/* test key */);

const connection = new Connection();
const lendy = new Lendy(connection, walletPublicKey);

const [userKey] = findUser(lendy.auth);

const account = await lendy.connection.getAccountInfo(userKey);
if (account) {
    return;
}

const createUserIx = await lendy.createUser('');

// send transaction
```

Additionally, we need to verify or create an external wallet account for the Borrower to receive principal tokens.

```tsx
import { TransactionInstruction, PublicKey, Connection } from '@solana/web3.js';
import { findUser, Lendy } from '@caryatid/lendy-sdk';
import {
    createAssociatedTokenAccountInstruction,
    getAccount,
    getAssociatedTokenAddressSync,
} from '@solana/spl-token';

const walletPublicKey = new PublicKey(/* test key */);
const principalMint = new PublicKey(/* test key */);
const connection = new Connection();
const lendy = new Lendy(connection, walletPublicKey);

const createPrincipalTokenAccountInstruction = async (
    principalMint: PublicKey,
): Promise<TransactionInstruction | null> => {
    const principalWallet = getAssociatedTokenAddressSync(principalMint, lendy.auth);
    try {
        await getAccount(lendy.connection, principalWallet, 'confirmed');
    } catch (e) {
        return createAssociatedTokenAccountInstruction(
            lendy.auth,
            principalWallet,
            lendy.auth,
            principalMint,
        );
    }
    return null;
}

const createPrincipalTokenAccountIx = await createPrincipalTokenAccountInstruction(principalMint);
if (createPrincipalTokenAccountIx) {
  // send transaction
}
```

Borrow

```tsx
import { PublicKey, Connection, SystemProgram } from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountIdempotentInstruction,
    NATIVE_MINT,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    createSyncNativeInstruction,
    createCloseAccountInstruction,
} from '@solana/spl-token';
import { Lendy, getUuid } from '@texture/lendy';

const walletPublicKey = new PublicKey(/* test key */);
const connection = new Connection();
const lendy = new Lendy(connection, walletPublicKey);
const bulkUuid = getUuid();

const collateralMint = new PublicKey(/* test key */);

const instructions = [];

const tokenAddress = getAssociatedTokenAddressSync(NATIVE_MINT, lendy.auth);
instructions.push(
	createAssociatedTokenAccountIdempotentInstruction(
	    lendy.auth,
	    tokenAddress,
	    lendy.auth,
	    NATIVE_MINT,
	);
)

const [toPubkey] = PublicKey.findProgramAddressSync(
  [lendy.auth.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), NATIVE_MINT.toBuffer()],
  ASSOCIATED_TOKEN_PROGRAM_ID
);

if (collateralMint.equals(NATIVE_MINT)) {
  instructions.push(SystemProgram.transfer({
		lendy.auth,
	  toPubkey,
	  1000000 + 10000 + 100 /* collateral amount + offer fee */,
	}));
  instructions.push(createSyncNativeInstruction(toPubkey, TOKEN_PROGRAM_ID));
}

instructions.push(
  await lendy.borrow(
    new PublicKey(/* test offer publicKey */),
    49400000000, /* principal amount */
    bulkUuid,
    v4().replaceAll('-', ''),
  ),
);

instructions.push(
  createCloseAccountInstruction(toPubkey, lendy.auth, lendy.auth)
);

// send transaction
```

## **Deposit**

```tsx
import { PublicKey, Connection, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { Lendy, findUser, findTokenWallet } from '@texture/lendy';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const walletPublicKey = new PublicKey(/* test key */);
const principalMint = new PublicKey(/* test key */);
const connection = new Connection();

async createPrincipalWallet = (principalMint: PublicKey) =>{
    const lendy = new Lendy(connection, walletPublicKey);
    const txs = [];
    const [userAcc] = findUser(walletPublicKey);
    const [tokenWallet] = findTokenWallet(userAcc, principalMint);

    try {
        await lendy.accounts.user(userAcc);
    } catch (e) {
        const createUserIx = await lendy.createUser('');
        txs.push(createUserIx);
    }

    try {
        await lendy.accounts.user(tokenWallet);
    } catch (e) {
        const createUserIx = await lendy.setupTokenWallet(principalMint);
        txs.push(createUserIx);
    }

    return txs;
}

const instructions = [];

const needPrincipalWrap = principalMint.equals(NATIVE_MINT);
const [toPubkey] = PublicKey.findProgramAddressSync(
    [walletPublicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), NATIVE_MINT.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
);

if (needPrincipalWrap) {
    const tokenAddress = getAssociatedTokenAddressSync(NATIVE_MINT, walletPublicKey);

    instructions.push(
        await createAssociatedTokenAccountIdempotentInstruction(
            walletPublicKey,
            tokenAddress,
            walletPublicKey,
            NATIVE_MINT,
        ),
        SystemProgram.transfer({
	        walletPublicKey,
          toPubkey,
					/* principal amount */,
        }),
        createSyncNativeInstruction(toPubkey, TOKEN_PROGRAM_ID),
    );
}

instructions.push(...(await createPrincipalWallet(principalMint)));

const lendy = new Lendy(connection, walletPublicKey);
instructions.push(await lendy.depositToken(principalMint, /* principal amount */));

if (needPrincipalWrap) {
	instructions.push(createCloseAccountInstruction(toPubkey, walletPublicKey, walletPublicKey));
}

// send transaction
```

## **Withdraw**

```tsx
import { PublicKey, Connection, TransactionInstruction } from '@solana/web3.js';
import {
  NATIVE_MINT,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
  createPrincipalTokenAccountInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
} from '@solana/spl-token';
import { Lendy } from '@texture/lendy';

const walletPublicKey = new PublicKey(/* test key */);
const principalMint = new PublicKey(/* test key */);
const connection = new Connection();

private async createPrincipalTokenAccountInstruction(
    principalMint,
): Promise<TransactionInstruction | null> {
    const lendy = new Lendy(this.connection, walletPublicKey);
    const principalWallet = getAssociatedTokenAddressSync(principalMint, lendy.auth);
    try {
        await getAccount(lendy.connection, principalWallet, 'confirmed');
    } catch (e) {
        return createAssociatedTokenAccountInstruction(
            lendy.auth,
            principalWallet,
            lendy.auth,
            principalMint,
        );
    }
    return null;
}

const instructions = [];

const needPrincipalWrap = principalMint.equals(NATIVE_MINT);
if (needPrincipalWrap) {
	const tokenAddress = getAssociatedTokenAddressSync(NATIVE_MINT, walletPublicKey);
	instructions.push(createAssociatedTokenAccountIdempotentInstruction(
    walletPublicKey,
    tokenAddress,
    walletPublicKey,
    NATIVE_MINT,
	));
}

if (!principalMint.equals(NATIVE_MINT)) {
    const createPrincipalTokenAccountIx = await createPrincipalTokenAccountInstruction(principalMint);
    if (createPrincipalTokenAccountIx) {
        instructions.push(createPrincipalTokenAccountIx);
    }
}

instructions.push(
    ...(await lendy.withdrawToken(principalMint, /* principal amount */)),
);

if (needWrap) {
    const [address] = PublicKey.findProgramAddressSync(
        [walletPublicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), NATIVE_MINT.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    instructions.push(
      createCloseAccountInstruction(address, walletPublicKey, walletPublicKey)
    );
}

// send transaction
```

## Claim

```tsx
import { PublicKey, Connection } from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createCloseAccountInstruction,
    getAccount,
    NATIVE_MINT,
} from '@solana/spl-token';
import { Lendy, findUser } from '@texture/lendy';

const walletPublicKey = new PublicKey(/* test key */);
const connection = new Connection();
const lendy = new Lendy(connection, walletPublicKey);

const collateralMintPublicKey = new PublicKey(/* test key */);
const loanPublicKey = new PublicKey(/* test key */);

const createCollateralWalletIxs = (
  await createCollateralWallet(new PublicKey(mint)),
).flat();

const claimIxs = await lendy.claim(loanPublicKey);

if (collateralMintPublicKey.equals(NATIVE_MINT)) {
    const collateralWallet = getAssociatedTokenAddressSync(
        NATIVE_MINT,
        lendy.auth,
    );
    claimIxs.push(
        createCloseAccountInstruction(
            collateralWallet,
            lendy.auth,
            lendy.auth,
        ),
    );
}

// send transactions

const createCollateralWallet = async (collateralMint: PublicKey) => {
    const txs = [];
    const [userAcc] = findUser(lendy.auth);
    const collateralWallet = getAssociatedTokenAddressSync(
        collateralMint,
        lendy.auth,
    );

    try {
        await lendy.accounts.user(userAcc);
    } catch (e) {
        txs.push(await lendy.createUser(''));
    }

    try {
        await getAccount(lendy.connection, collateralWallet, 'confirmed');
    } catch (e) {
        txs.push(
            createAssociatedTokenAccountInstruction(
                lendy.auth,
                collateralWallet,
                lendy.auth,
                collateralMint,
            ),
        );
    }

    return txs;
}
```

## **Repay**

```tsx
import { PublicKey, Connection } from '@solana/web3.js';
import {
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createAssociatedTokenAccountIdempotentInstruction,
    createCloseAccountInstruction,
    getAccount,
    NATIVE_MINT,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Lendy, findAssociatedTokenAddress } from '@texture/lendy';

const walletPublicKey = new PublicKey(/* test key */);
const connection = new Connection();
const lendy = new Lendy(connection, walletPublicKey);

const loanPublicKey = new PublicKey(/* test key */);
const principalMintPublicKey = new PublicKey(/* test key */);
const collateralMintPublicKey = new PublicKey(/* test key */);
const pairPublicKey = new PublicKey(/* test key */);

const createInstructions: TransactionInstruction[] = [];
const repayInstructions: TransactionInstruction[] = [];
const closeInstructions: TransactionInstruction[] = [];

const loanData = await lendy.accounts.loan(loanPublicKey);
const lender = await lendy.accounts.user(loanData.lender);

const checkAndGetCreateAssociatedTokenAccountIx = async (
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey = payer,
): Promise<TransactionInstruction | false> {
  const tokenAddress = getAssociatedTokenAddressSync(mint, owner);
  try {
    await getAccount(connection, tokenAddress, 'confirmed');
  } catch (e) {
    return createAssociatedTokenAccountIdempotentInstruction(
      payer,
      tokenAddress,
      owner,
      mint,
    );
  }
  return false;
}

if (!principalMintPublicKey.equals(NATIVE_MINT)) {
    const ix = await checkAndGetCreateAssociatedTokenAccountIx(
        lendy.auth,
        principalMintPublicKey,
        lender.owner,
    );
    if (ix) createInstructions.push(ix);
}

const [token] = PublicKey.findProgramAddressSync(
    [lendy.auth.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), NATIVE_MINT.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
);

{
    const ix = await checkAndGetCreateAssociatedTokenAccountIx(
        lendy.auth,
        collateralMintPublicKey,
    );
    if (ix) createInstructions.push(ix);
    if (collateralMintPublicKey.equals(NATIVE_MINT))) {
        closeInstructions.push(
          createCloseAccountInstruction(token, lendy.auth, lendy.auth)
        );
    }
}

{
    const ix = await checkAndGetCreateAssociatedTokenAccountIx(
        lendy.auth,
        principalMintPublicKey,
    );
    if (ix) createInstructions.push(ix);
    if (principalMintPublicKey.equals(NATIVE_MINT)) {
        closeInstructions.push(
          createCloseAccountInstruction(token, lendy.auth, lendy.auth)
        );
    }
}

const repayIxs = await (principalMintPublicKey.equals(NATIVE_MINT))
    ? lendy.repaySol(loanPublicKey, pairPublicKey)
    : lendy.repay(loanPublicKey, pairPublicKey);

repayInstructions.push(repayIxs);

const instructions = [...createInstructions, ...repayInstructions, ...closeInstructions];

// send transaction
```