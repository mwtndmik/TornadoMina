import { Mina, PrivateKey, PublicKey, isReady } from 'snarkyjs';
import { IncrementSecret } from './IncrementSecret';

describe('IncrementSecret.js', () => {
  let zkApp: IncrementSecret,
    zkAppPrivateKey: PrivateKey,
    zkAppAddress: PublicKey,
    sender: PublicKey,
    senderKey: PrivateKey;

  beforeEach(async () => {
    await isReady;
    let Local = Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);
  });
});
