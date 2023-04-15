import {
  Field,
  SmartContract,
  state,
  State,
  method,
  MerkleWitness,
} from 'snarkyjs';

export class MerkleWitness20 extends MerkleWitness(20) {}

export class BasicMerkleMapContract extends SmartContract {
  @state(Field) num = State<Field>();

  @method initState() {
    this.num.set(Field(0));
  }

  @method keyToIndexValidation(key: Field, witness: Field) {
    // the bit map is reversed to make reconstructing the key during proving more convenient
    let keyBits = key
      .toBits()
      .slice(0, 255)
      .reverse()
      .map((b) => b.toBoolean());

    let n = 0n;
    for (let i = 0; i < keyBits.length; i++) {
      const b = keyBits[i] ? 1 : 0;
      n += 2n ** BigInt(i) * BigInt(b);
    }

    witness.assertEquals(Field(n));
    this.num.set(Field(1));
  }
}
