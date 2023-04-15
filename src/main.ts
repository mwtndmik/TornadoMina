import {
  AccountUpdate,
  Field,
  Mina,
  PrivateKey,
  isReady,
  shutdown,
} from 'snarkyjs';
import { IncrementSecret } from './IncrementSecret.js';

await isReady;

console.log('SnarkyJS loaded');

const useProof = false;

const Local = Mina.LocalBlockchain({ proofsEnabled: useProof });
Mina.setActiveInstance(Local);
const { privateKey: deployerKey, publicKey: deployerAccount } =
  Local.testAccounts[0];
const { privateKey: senderKey, publicKey: senderAccount } =
  Local.testAccounts[1];

const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();

const zkAppInstance = new IncrementSecret(zkAppAddress);

const salt = Field.random();

const deployTxn = await Mina.transaction(deployerAccount, () => {
  AccountUpdate.fundNewAccount(deployerAccount);
  zkAppInstance.deploy();
});
await deployTxn.sign([deployerKey, zkAppPrivateKey]).send();

const tx = await Mina.transaction(deployerAccount, () => {
  zkAppInstance.initState(salt, Field(750));
});
await tx.prove();
await tx.sign([deployerKey]).send();

const num0 = zkAppInstance.x.get();
console.log('state after init:', num0.toString());

const txn1 = await Mina.transaction(senderAccount, () => {
  zkAppInstance.incrementSecret(salt, Field(750));
});
await txn1.prove();
await txn1.sign([senderKey]).send();

const num1 = zkAppInstance.x.get();
console.log('state after txn1:', num1.toString());

console.log('Shutting down');

await shutdown();
