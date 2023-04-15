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

  async function deposit() {
    const nonce = Field(Mina.getAccount(sender).nonce.toBigint());
    const nullifier = Field.random();
    const commitment = Poseidon.hash([nullifier, nonce]);
    const commitmentWitness = commitmentMap.getWitness(commitment);
    const depositTxn = await Mina.transaction(sender, () => {
      zkApp.deposit(commitment, commitmentWitness);
    });
    await depositTxn.prove();
    await depositTxn.sign([senderKey]).send();
    commitmentMap.set(commitment, Field(1));
    return { nonce, nullifier, commitment, commitmentWitness };
  }

  async function withdraw({
    nonce,
    nullifier,
    commitment,
  }: Awaited<ReturnType<typeof deposit>>) {
    const commitmentWitness = commitmentMap.getWitness(commitment);
    const nullifierHash = Poseidon.hash([nullifier]);
    const nullifierHashWitness = nullifierHashesMap.getWitness(nullifierHash);
    const withdrawTxn = await Mina.transaction(sender, () => {
      zkApp.withdraw(nullifier, nonce, nullifierHashWitness, commitmentWitness);
    });
    await withdrawTxn.prove();
    await withdrawTxn.sign([senderKey]).send();
    nullifierHashesMap.set(nullifierHash, Field(1));
  }

  it('can deposit', async () => {
    const beforeBalance = Mina.getBalance(sender).toBigInt();
    await deposit();
    expect(Mina.getBalance(sender).toBigInt()).toBe(beforeBalance - 1000000n);
    expect(zkApp.commitmentsRoot.get()).toStrictEqual(commitmentMap.getRoot());
    expect(Mina.getBalance(zkApp.address).toBigInt()).toBe(1000000n);
  });
  it('should fail on depositing already deposit commitment', async () => {
    const { commitment } = await deposit();
    expect(zkApp.commitmentsRoot.get()).toStrictEqual(commitmentMap.getRoot());
    const commitmentWitness2 = commitmentMap.getWitness(commitment);
    try {
      const depositTxn2 = await Mina.transaction(sender, () => {
        zkApp.deposit(commitment, commitmentWitness2);
      });
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.message).toContain('assert_equal');
    }
  });
  it('can withdraw', async () => {
    const beforeBalance = Mina.getBalance(sender).toBigInt();
    const depositResult = await deposit();
    await withdraw(depositResult);
    expect(Mina.getBalance(sender).toBigInt()).toBe(beforeBalance);
    expect(zkApp.nullifierHashesRoot.get()).toStrictEqual(
      nullifierHashesMap.getRoot()
    );
  });
  it('should fail on withdrawing already withdrawn commitment', async () => {
    const depositResult = await deposit();
    await withdraw(depositResult);
    await deposit();
    try {
      await withdraw(depositResult);
      expect(false).toBe(true);
    } catch (error: any) {
      expect(error.message).toContain('assert_equal');
    }
  });
  afterAll(() => {
    setTimeout(shutdown, 0);
  });
});
