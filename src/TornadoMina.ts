import {
  Field,
  MerkleTree,
  MerkleMap,
  Poseidon,
  SmartContract,
  State,
  method,
  state,
} from 'snarkyjs';

const denomination = Field(10);

export class TornadoMina extends SmartContract {
  @state(Field) commitments = State<MerkleTree>();
  @state(Field) nullifierHashes = State<MerkleMap>();

  @method deposit(commitment: Field) {
    // assert msg.value == denomination
    // update commitment MerkleTree
  }

  @method withdraw(nullifier: Field, nonce: Field) {
    // assert nullifierHash not yet used
    // assert commitment = Poseidon(nullifier + nonce)
    // assert commitment is included in MerkleTree
    // set nullifierHashes(nullifierHash) as True
    // transfer denomination MINA
  }
}
