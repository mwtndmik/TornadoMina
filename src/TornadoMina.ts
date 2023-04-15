import {
  Field,
  SmartContract,
  State,
  method,
  state,
  MerkleMapWitness,
  AccountUpdate,
  UInt64,
  Poseidon,
} from 'snarkyjs';

export class TornadoMina extends SmartContract {
  @state(Field) commitmentsRoot = State<Field>();
  @state(Field) nullifierHashesRoot = State<Field>();

  @method initState(
    initialCommitmentsRoot: Field,
    initialNullifierHashesRoot: Field
  ) {
    this.commitmentsRoot.set(initialCommitmentsRoot);
    this.nullifierHashesRoot.set(initialNullifierHashesRoot);
  }

  @method deposit(commitment: Field, commitmentWitness: MerkleMapWitness) {
    const initialRoot = this.commitmentsRoot.get();
    this.commitmentsRoot.assertEquals(initialRoot);

    // commitment = Poseidon(nullifier + nonce)
    const [rootBefore, key] = commitmentWitness.computeRootAndKey(Field(0));
    rootBefore.assertEquals(initialRoot);

    key.assertEquals(commitment);

    // compute the root after incrementing
    const [rootAfter] = commitmentWitness.computeRootAndKey(Field(1));

    this.commitmentsRoot.set(rootAfter);

    const payerUpdate = AccountUpdate.createSigned(this.sender);
    payerUpdate.send({ to: this.address, amount: UInt64.from(1000000) });
  }

  @method withdraw(
    nullifier: Field,
    nonce: Field,
    nullifierWitness: MerkleMapWitness,
    commitmentWitness: MerkleMapWitness
  ) {
    // assert nullifierHash not yet used
    const initialRoot = this.nullifierHashesRoot.get();
    this.nullifierHashesRoot.assertEquals(initialRoot);

    const [rootBefore, key] = nullifierWitness.computeRootAndKey(Field(0));
    rootBefore.assertEquals(initialRoot);

    const nullifierHash = Poseidon.hash([nullifier]);
    key.assertEquals(nullifierHash);

    // assert commitment = Poseidon(nullifier + nonce)
    const expectedCommitment = Poseidon.hash([nullifier, nonce]);
    const [commitmentRootBefore, commitment] =
      commitmentWitness.computeRootAndKey(Field(1));
    // assert commitment is included in MerkleTree
    const commitmentRoot = this.commitmentsRoot.get();
    this.commitmentsRoot.assertEquals(commitmentRoot);
    commitmentRootBefore.assertEquals(commitmentRoot);
    commitment.assertEquals(expectedCommitment);

    // set nullifierHashes(nullifierHash) as True
    const [rootAfter] = nullifierWitness.computeRootAndKey(Field(1));
    this.nullifierHashesRoot.set(rootAfter);

    // transfer denomination MINA
    this.send({ to: this.sender, amount: UInt64.from(1000000) });
  }
}
