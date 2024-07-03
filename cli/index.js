#!/usr/bin/env -S node --inspect

const { argv } = require('node:process');
const { PublicKey } = require('@solana/web3.js');
const args = require('args');

args
  .option('rpc', 'RPC node URL', '')
  .option('key', 'private key file', './lender.json')

  .option('borrow', 'Borrow USDC')
  .option('extendConstPrincipal', 'Extend')

  .option('offer', 'amount')
  .option('amount', 'amount')
  .option('uuid', 'uuid')
  .option('principalMint', 'principal mint')

  .option('makeOffer', 'Create offer')

  .option('pair', 'pair', '3VZpYYp2DnjTDRC1qfy8Y9KKgV7QVGfrkViLg1BuhKiZ')
  .option('principal', 'principal', '49400000000')
  .option('collateral', 'collateral', '1000000000')
  .option('clientOfferUuid', 'clientOfferUuid', '83ebbdaaf2d24cce');

const flags = args.parse(argv);

const Cli = require('./cli');

(async () => {
  const cli = await new Cli(flags.rpc, flags.key);

  console.log(flags);
  switch (true) {
    case flags.borrow: {
      return cli.borrow({
        offer: new PublicKey(flags.offer),
        amount: BigInt(flags.amount),
        uuid: flags.uuid,
        clientLoanUuid: flags.clientLoanUuid,
        principalMint: new PublicKey(flags.principalMint),
      });
    }
    case flags.extendConstPrincipal: {
      return cli.extendConstPrincipal({
        loanKey: new PublicKey(flags.loan),
        offerKey: new PublicKey(flags.offer),
        bulkUuid: flags.uuid,
        clientLoanUuid: flags.clientLoanUuid,
      });
    }
    default: {
      return cli.makeOffer({
        pair: new PublicKey(flags.pair),
        principal: BigInt(flags.principal),
        collateral: BigInt(flags.collateral),
        clientOfferUuid: flags.clientOfferUuid,
      });
    }
  }
})();
