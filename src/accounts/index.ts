import { Connection, PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';

import { decodeUserLayout, User } from './layouts/User/user';
import { decodeOfferLayout, Offer } from './layouts/Offer';
import { decodePairLayout, Pair } from './layouts/Pair';
import { decodeLoanLayout, Loan } from './layouts/Loan';

type AccountTypes = 'user' | 'offer' | 'pair';
type AccountTools = {
  pubkey: PublicKey;
  accountType: AccountTypes;
};

const decoders = {
  user: decodeUserLayout,
  offer: decodeOfferLayout,
  pair: decodePairLayout,
};

export class Accounts {
  constructor(private readonly connection: Connection) {}

  user(pubkey: PublicKey) {
    return this.getAccountInfo<User>(pubkey, decodeUserLayout);
  }

  offer(pubkey: PublicKey) {
    return this.getAccountInfo<Offer>(pubkey, decodeOfferLayout);
  }

  loan(pubkey: PublicKey) {
    return this.getAccountInfo<Loan>(pubkey, decodeLoanLayout);
  }

  pair(pubkey: PublicKey) {
    return this.getAccountInfo<Pair>(pubkey, decodePairLayout);
  }

  public async getMultipleAccounts(data: AccountTools[]) {
    const accounts = await this.connection.getMultipleAccountsInfo(
      data.map(({ pubkey }) => pubkey),
    );

    return accounts.map((accountInfo) => {
      const { accountType, pubkey } = data.shift() as AccountTools;
      if (!accountInfo) throw Error(`Account ${pubkey.toString()} not found`);
      return decoders[accountType](accountInfo.data);
    });
  }

  private async getAccountInfo<P>(
    pubkey: PublicKey,
    decoder: (data: Buffer) => P,
  ) {
    const accountInfo = await this.connection.getAccountInfo(pubkey);
    if (!accountInfo) {
      throw Error(`Account ${pubkey.toString()} not found`);
    }
    return decoder(accountInfo.data);
  }
}
