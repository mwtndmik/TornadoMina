import {
  AccountUpdate,
  Field,
  MerkleTree,
  MerkleWitness,
  Mina,
  PrivateKey,
  PublicKey,
  isReady,
  shutdown,
} from 'snarkyjs';
import { BasicMerkleTreeContract } from './BasicMerkleTreeContract';

const height = 20;
class MerkleWitness20 extends MerkleWitness(height) {}

describe('BasicMerkleTreeContract.js', () => {
  let zkApp: BasicMerkleTreeContract,
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
    zkApp = new BasicMerkleTreeContract(zkAppAddress);

    const deployTxn = await Mina.transaction(sender, () => {
      AccountUpdate.fundNewAccount(sender);
      zkApp.deploy();
    });
    await deployTxn.prove();
    await deployTxn.sign([senderKey, zkAppPrivateKey]).send();

    const initTxn = await Mina.transaction(sender, () => {
      zkApp.initState(tree.getRoot());
    });
    await initTxn.prove();
    await initTxn.sign([senderKey]).send();
  });

  it('can update leaf', async () => {
    const incrementIndex = 522n;
    const incrementAmount = Field(9);

    // get the witness for the current tree
    const witness = new MerkleWitness20(tree.getWitness(incrementIndex));

    // update the leaf locally
    tree.setLeaf(incrementIndex, incrementAmount);
    // update the smart contract
    const txn = await Mina.transaction(sender, () => {
      zkApp.update(
        witness,
        Field(0), // leafs in new trees start at a state of 0
        incrementAmount
      );
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    expect(zkApp.treeRoot.get()).toStrictEqual(tree.getRoot());
  });

  afterAll(() => {
    setTimeout(shutdown, 0);
  });
});
