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

export class Tradeable extends SmartContract {
    @prop()
    owner: PubKey

    @prop()
    content: ByteString

    @prop(true)
    ask: bigint

    @prop(true)
    bid: bigint

    @prop(true)
    bidder: PubKey

    constructor(content: ByteString, owner: PubKey, ask: bigint) {
        super(...arguments)
        this.content = content
        this.owner = owner
        this.ask = ask
        this.bid = 0n
        this.bidder = owner
    }

    @method()
    public setAsk(ask: bigint, signature: Sig) {
        assert(
            this.checkSig(signature, this.owner),
            `checkSig failed, pubkey: ${this.owner}`
        )

        this.ask = ask

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
    public placeBid(bid: bigint, bidder: PubKey) {

      if (this.bid > 0) {

        console.log('bid', { bid, current: this.bid })

        assert(bid > this.bid, "Bid must be higher than current bid")

      }

      const previousBidder = this.bidder;

      const previousBid = this.bid;

      this.bid = bid

      this.bidder = bidder

      let newBalance = this.ctx.utxo.value + bid

      console.log({ newBalance })

      const stateOutput: ByteString = this.buildStateOutput(
          this.ctx.utxo.value
      )

      let outputs = stateOutput

      if (this.ask > 0 && this.bid > this.ask) {

        newBalance = newBalance - previousBid

        if (previousBid > 0) {

          const refund: ByteString = Utils.buildPublicKeyHashOutput(
              hash160(previousBidder),
              previousBid
          )

          outputs += refund

        }

        this.owner = bidder;

        // reset the bid and ask upon a successful trade
        this.ask = 0n;
        this.bid = 0n;

      }

      if (this.changeAmount > 0n) {
          outputs += this.buildChangeOutput()
      }

      assert(this.ctx.hashOutputs == hash256(outputs), 'hashOutputs mismatch')

    }

}

