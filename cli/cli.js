const { readFile } = require('node:fs/promises');
const { resolve } = require('node:path');

const {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
} = require('@solana/web3.js');
const { Lendy, findUser } = require('../build');
const {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} = require('@solana/spl-token');

module.exports = class Cli {
  constructor(rpcEndpoint, keyPath) {
    return this.init(rpcEndpoint, keyPath).catch(console.error);
  }

  async init(rpcEndpoint, keyPath) {
    await this.readKeypair(keyPath);
    this.connection = new Connection(rpcEndpoint);
    this.lendy = new Lendy(this.connection, this.keypair.publicKey);
    return this;
  }

  async borrow({ offer, amount, uuid, clientLoanUuid, principalMint }) {
    console.log('principalMint', principalMint.toString());
    const mint = await getMint(this.connection, principalMint);
    console.log('mint', mint);
    const principalWallet = getAssociatedTokenAddressSync(
      principalMint,
      this.keypair.publicKey,
    );
    const ixCreateAta = createAssociatedTokenAccountInstruction(
      this.keypair.publicKey,
      principalWallet,
      this.keypair.publicKey,
      principalMint,
    );
    /* const ix = */ await this.lendy.borrow(
      offer,
      amount,
      uuid,
      clientLoanUuid,
    );
    return this.execute([ixCreateAta /*ix*/]);
  }

  async extendConstPrincipal({ loanKey, offerKey, bulkUuid, clientLoanUuid }) {
    const ix = await this.lendy.extendConstPrincipal(
      loanKey,
      offerKey,
      bulkUuid,
      clientLoanUuid,
    );
    return this.execute([ix]);
  }

  async makeOffer({ pair, principal, collateral, clientOfferUuid }) {
    const [userKey] = findUser(this.keypair.publicKey);
    const ixs = [];
    try {
      await this.lendy.accounts.user(userKey);
    } catch (e) {
      ixs.push(await this.lendy.createUser(''));
    }

    ixs.push(
      await this.lendy.makeOffer(pair, principal, collateral, clientOfferUuid),
    );
    return this.execute(ixs);
  }

  async execute(instructions) {
    const transaction = await this.tx(this.keypair.publicKey, instructions);
    const sig = await this.sendTx(transaction);
    console.log(sig);
    return sig;
  }

  async tx(payerKey, instructions) {
    const { blockhash } = await this.connection.getLatestBlockhash();
    const ixComputeBudget = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1e6,
    });
    instructions.unshift(ixComputeBudget);
    return new VersionedTransaction(
      new TransactionMessage({
        payerKey,
        instructions,
        recentBlockhash: blockhash,
      }).compileToV0Message(),
    );
  }

  async sendTx(transaction) {
    transaction.sign([this.keypair]);
    try {
      return this.connection.sendRawTransaction(transaction.serialize());
    } catch (e) {
      console.error(JSON.stringify(e.logs, null, 2));
    }
  }

  async readKeypair(keyPath) {
    const rawSecretKey = await readFile(resolve(__dirname, keyPath));
    this.keypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(rawSecretKey.toString())),
    );
  }
};
