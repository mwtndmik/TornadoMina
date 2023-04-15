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
import { TornadoMina } from './TornadoMina.js';
await isReady;

console.log('SnarkyJS loaded');

interface User {
  publicKey: PublicKey;
  privateKey: PrivateKey;
  nonce: Field;
  nullifier: Field;
  commitment: Field;
}

let zkApp: TornadoMina,
  zkAppPrivateKey: PrivateKey,
  zkAppAddress: PublicKey,
  sender: PublicKey,
  senderKey: PrivateKey,
  commitmentMap: MerkleMap,
  nullifierHashesMap: MerkleMap;

await isReady;
commitmentMap = new MerkleMap();
nullifierHashesMap = new MerkleMap();
const Local = Mina.LocalBlockchain({ proofsEnabled: false });
Mina.setActiveInstance(Local);
sender = Local.testAccounts[0].publicKey;
senderKey = Local.testAccounts[0].privateKey;

function createUser(index: number): User {
  return {
    publicKey: Local.testAccounts[index].publicKey,
    privateKey: Local.testAccounts[index].privateKey,
    nonce: Field(0),
    nullifier: Field(0),
    commitment: Field(0),
  };
}

let alice = createUser(1);
let bob = createUser(2);

// Local.testAccounts[0];
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

async function deposit(user: User) {
  const nonce = Field(Mina.getAccount(user.publicKey).nonce.toBigint());
  const nullifier = Field.random();
  const commitment = Poseidon.hash([nullifier, nonce]);
  const commitmentWitness = commitmentMap.getWitness(commitment);
  const depositTxn = await Mina.transaction(user.publicKey, () => {
    zkApp.deposit(commitment, commitmentWitness);
  });
  await depositTxn.prove();
  await depositTxn.sign([user.privateKey]).send();
  commitmentMap.set(commitment, Field(1));
  user.nonce = nonce;
  user.nullifier = nullifier;
  user.commitment = commitment;
  return user;
}

async function withdraw(user: User) {
  const commitmentWitness = commitmentMap.getWitness(user.commitment);
  const nullifierHash = Poseidon.hash([user.nullifier]);
  const nullifierHashWitness = nullifierHashesMap.getWitness(nullifierHash);
  const withdrawTxn = await Mina.transaction(user.publicKey, () => {
    zkApp.withdraw(
      user.nullifier,
      user.nonce,
      nullifierHashWitness,
      commitmentWitness
    );
  });
  await withdrawTxn.prove();
  await withdrawTxn.sign([user.privateKey]).send();
  nullifierHashesMap.set(nullifierHash, Field(1));
}

function printBalances() {
  const contractBalance = Mina.getBalance(zkAppAddress).toBigInt();
  const aliceBalance = Mina.getBalance(alice.publicKey).toBigInt();
  const bobBalance = Mina.getBalance(bob.publicKey).toBigInt();
  console.log(
    `Balance sheet:  zkApp: ${contractBalance}, alice: ${aliceBalance}, bob: ${bobBalance}\n`
  );
}
console.log('initial state');
printBalances();

alice = await deposit(alice);
console.log('alice depositted');
printBalances();

bob = await deposit(bob);
console.log('bob depositted');
printBalances();

await withdraw(alice);
console.log('alice withdrawn');
printBalances();

setTimeout(shutdown, 0);
