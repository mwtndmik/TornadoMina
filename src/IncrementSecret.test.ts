import {
  AccountUpdate,
  Field,
  Mina,
  Poseidon,
  PrivateKey,
  PublicKey,
  isReady,
  shutdown,
} from 'snarkyjs';
import { IncrementSecret } from './IncrementSecret';

describe('IncrementSecret.js', () => {
  let zkApp: IncrementSecret,
    zkAppPrivateKey: PrivateKey,
    zkAppAddress: PublicKey,
    sender: PublicKey,
    senderKey: PrivateKey,
    Local: ReturnType<typeof Mina.LocalBlockchain>;

  beforeEach(async () => {
    await isReady;
    Local = Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);
    sender = Local.testAccounts[0].publicKey;
    senderKey = Local.testAccounts[0].privateKey;
    Local.testAccounts[0];
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new IncrementSecret(zkAppAddress);
  });
  afterAll(() => {
    setTimeout(shutdown, 0);
  });

  it('can deploy', async () => {
    await deploy(zkApp, zkAppPrivateKey, sender, senderKey);
  });

  it('can deploy and initiate', async () => {
    await deploy(zkApp, zkAppPrivateKey, sender, senderKey);
    const salt = Field.random();
    const secret = Field(750);
    const tx = await Mina.transaction(sender, () => {
      zkApp.initState(salt, secret);
    });
    await tx.prove();
    await tx.sign([senderKey]).send();
    const retrievedCommitment = zkApp.x.get();
    expect(retrievedCommitment).toStrictEqual(Poseidon.hash([salt, secret]));
  });
  it('can retrieve nonce', async () => {
    expect(Local.getAccount(sender).nonce.toBigint()).toBe(0n);
  });
});

async function deploy(
  zkApp: IncrementSecret,
  zkAppPrivateKey: PrivateKey,
  sender: PublicKey,
  senderKey: PrivateKey
) {
  let tx = await Mina.transaction(sender, () => {
    AccountUpdate.fundNewAccount(sender);
    zkApp.deploy();
  });
  await tx.prove();
  // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
  await tx.sign([zkAppPrivateKey, senderKey]).send();
}
