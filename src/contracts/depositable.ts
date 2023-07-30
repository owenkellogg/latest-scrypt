import {
    assert,
    ByteString,
    method,
    prop,
    SmartContract,
    Sig,
    PubKey,
    hash256,
    hash160,
    Utils,
} from 'scrypt-ts'

export class Depositable extends SmartContract {
    @prop(true)
    owner: PubKey

    constructor(owner: PubKey) {
        super(...arguments)
        this.owner = owner
    }

    @method()
    public unlock(signature: Sig) {
        // No assertion that the state out remains the same. By calling remove() you essentially
        // destroy the smart contract and may reclaim all the satoshis

        assert(
            this.checkSig(signature, this.owner),
            `checkSig failed, pubkey: ${this.owner}`
        )
    }

    @method()
    public deposit(amount: bigint, note: ByteString) {
        const newBalance = this.ctx.utxo.value + amount

        const stateOutput: ByteString = this.buildStateOutput(newBalance)
        //const stateOutput: ByteString = this.buildStateOutput(this.ctx.utxo.value)

        let outputs = stateOutput

        if (this.changeAmount > 0n) {
            outputs += this.buildChangeOutput()
        }

        assert(this.ctx.hashOutputs == hash256(outputs), 'hashOutputs mismatch')
    }
}
