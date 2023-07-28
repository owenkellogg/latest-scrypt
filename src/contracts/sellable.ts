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

export class Sellable extends SmartContract {
    @prop()
    owner: PubKey

    @prop()
    topic: ByteString

    @prop(true)
    price: bigint

    constructor(topic: ByteString, owner: PubKey, price = 1n) {
        super(...arguments)
        this.topic = topic
        this.owner = owner
        this.price = price
    }

    @method()
    public setPrice(price: bigint, signature: Sig) {
        assert(
            this.checkSig(signature, this.owner),
            `checkSig failed, pubkey: ${this.owner}`
        )

        this.price = price

        // Ensure Contract State Remains Locked With Exact Satoshis Value
        const amount: bigint = this.ctx.utxo.value
        let outputs: ByteString = this.buildStateOutput(amount)
        if (this.changeAmount > 0n) {
            outputs += this.buildChangeOutput()
        }
        assert(this.ctx.hashOutputs == hash256(outputs), 'hashOutputs mismatch')
    }

    @method()
    public remove(signature: Sig) {
        // No assertion that the state out remains the same. By calling remove() you essentially
        // destroy the smart contract and may reclaim all the satoshis

        assert(
            this.checkSig(signature, this.owner),
            `checkSig failed, pubkey: ${this.owner}`
        )
    }

    @method()
    public buy(pubKey: PubKey) {
        assert(this.price > 0, 'Price of 0 means not actively for sale')

        const seller = this.owner

        // ensure seller receives the asking price
        const purchase: ByteString = Utils.buildPublicKeyHashOutput(
            hash160(seller),
            this.price
        )

        // assign ownership to buyer
        this.owner = pubKey

        const stateOutput: ByteString = this.buildStateOutput(
            this.ctx.utxo.value
        )
        // verify current tx has this single output

        let outputs = stateOutput + purchase

        if (this.changeAmount > 0n) {
            outputs += this.buildChangeOutput()
        }

        assert(this.ctx.hashOutputs == hash256(outputs), 'hashOutputs mismatch')
    }
}
