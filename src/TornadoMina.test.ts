import {
  AccountUpdate,
  Field,
  MerkleMap,
  Mina,
  Poseidon,
  PrivateKey,
  PublicKey,
  isReady,
  shutdown,
} from 'snarkyjs';
import { TornadoMina } from './TornadoMina';

describe('TornadoMina.js', () => {
  let zkApp: TornadoMina,
    zkAppPrivateKey: PrivateKey,
    zkAppAddress: PublicKey,
    sender: PublicKey,
    senderKey: PrivateKey,
    commitmentMap: MerkleMap,
    nullifierHashesMap: MerkleMap;

  beforeEach(async () => {
    await isReady;
    commitmentMap = new MerkleMap();
    nullifierHashesMap = new MerkleMap();
    const Local = Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);
    sender = Local.testAccounts[0].publicKey;
    senderKey = Local.testAccounts[0].privateKey;
    Local.testAccounts[0];
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new TornadoMina(zkAppAddress);

    const deployTxn = await Mina.transaction(sender, () => {
      AccountUpdate.fundNewAccount(sender);
      zkApp.deploy();
    });
    await deployTxn.prove();
    await deployTxn.sign([senderKey, zkAppPrivateKey]).send();

    const initTxn = await Mina.transaction(sender, () => {
      zkApp.initState(commitmentMap.getRoot(), nullifierHashesMap.getRoot());
    });
    await initTxn.prove();
    await initTxn.sign([senderKey]).send();
  });
  it('can deposit', async () => {
    const beforeBalance = Mina.getBalance(sender).toBigInt();
    const nonce = Field(Mina.getAccount(sender).nonce.toBigint());
    const nullifier = Field.random();
    const commitment = Poseidon.hash([nullifier, nonce]);
    const commitmentWitness = commitmentMap.getWitness(commitment);
    const depositTxn = await Mina.transaction(sender, () => {
      zkApp.deposit(commitment, commitmentWitness);
    });
    await depositTxn.prove();
    await depositTxn.sign([senderKey]).send();
    expect(Mina.getBalance(sender).toBigInt()).toBe(beforeBalance - 1000000n);
  });
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  it('should fail on depositing already deposit commiment', async () => {});
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  it('can withdraw', async () => {});
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  it('should fail on withdrawing already withdrawn commitment', async () => {});
  afterAll(() => {
    setTimeout(shutdown, 0);
  });
});
