import { PublicKey } from '@solana/web3.js';
import { v4 } from 'uuid';
import { findOffer, findUser } from './pda';

export const getUuid = v4().replaceAll('-', '');

export const getOfferKey = (walletPublicKey: PublicKey, uuid: string) => {
    const [lenderKey] = findUser(walletPublicKey);
    const clientOfferUuidBuffer = Buffer.alloc(16);
    clientOfferUuidBuffer.write(uuid);
    const [offerKey] = findOffer(clientOfferUuidBuffer, lenderKey);

    return offerKey;
}