import {
  AccountUpdate,
  Field,
  MerkleTree,
  MerkleWitness,
  MerkleMap,
  Mina,
  PrivateKey,
  PublicKey,
  isReady,
  shutdown,
  Poseidon,
} from 'snarkyjs';
import { BasicMerkleMapContract } from './BasicMerkleMapContract';

const height = 20;
class MerkleWitness20 extends MerkleWitness(height) {}

describe('BasicMerkleTreeContract.js', () => {
  let zkApp: BasicMerkleMapContract,
    zkAppPrivateKey: PrivateKey,
    zkAppAddress: PublicKey,
    sender: PublicKey,
    senderKey: PrivateKey,
    tree: MerkleTree;
  beforeEach(async () => {
    await isReady;
    tree = new MerkleTree(height);
    const Local = Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);
    sender = Local.testAccounts[0].publicKey;
    senderKey = Local.testAccounts[0].privateKey;
    Local.testAccounts[0];
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new BasicMerkleMapContract(zkAppAddress);

    const deployTxn = await Mina.transaction(sender, () => {
      AccountUpdate.fundNewAccount(sender);
      zkApp.deploy();
    });
    await deployTxn.prove();
    await deployTxn.sign([senderKey, zkAppPrivateKey]).send();

    const initTxn = await Mina.transaction(sender, () => {
      zkApp.initState();
    });
    await initTxn.prove();
    await initTxn.sign([senderKey]).send();
  });

  it('can verify key to index', async () => {
    const instance = new MerkleMap();
    const hash = Poseidon.hash([Field(9)]);
    const index = Field(instance._keyToIndex(hash));

    // verify key to index
    const txn = await Mina.transaction(sender, () => {
      zkApp.keyToIndexValidation(hash, index);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    expect(zkApp.num.get()).toStrictEqual(Field(1));
  });

  afterAll(() => {
    setTimeout(shutdown, 0);
  });
});
