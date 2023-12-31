
import {
    assert,
    ByteString,
    PubKey,
    toByteString,
    method,
    prop,
    SmartContract,
    Sig,
    hash256,
    hash160,
    Utils,
} from 'scrypt-ts'

interface MintDebitCard {
    app_public_key: string
    player_public_key: string
}

export class DebitCard extends SmartContract {
    @prop()
    app: PubKey

    @prop()
    player: PubKey

    @prop()
    version: ByteString

    @prop(true)
    active: boolean

    constructor(
        app: PubKey,
        player: PubKey,
        active: boolean,
    ) {
        super(...arguments)
        this.app = app
        this.player = player
        this.active = active
        this.version = toByteString('0.2.2', true)
    }

    static mint({
        app_public_key,
        player_public_key,
    }: MintDebitCard): DebitCard {
        const app = PubKey(toByteString(app_public_key))

        const player = PubKey(toByteString(player_public_key))

        return new DebitCard(app, player, true)
    }

    @method()
    public charge(value: bigint, reason: ByteString, signature: Sig) {
        const outputs = this.buildStateOutput(this.ctx.utxo.value - value)

        assert(this.active)

        assert(this.ctx.hashOutputs === hash256(outputs))

        assert(this.checkSig(signature, this.app))
    }

    @method()
    public freeze(signature: Sig) {
        this.active = false

        const outputs = this.buildStateOutput(this.ctx.utxo.value)

        assert(this.ctx.hashOutputs === hash256(outputs))

        assert(this.checkSig(signature, this.player))
    }

    @method()
    public activate(signature: Sig) {
        this.active = true

        const outputs = this.buildStateOutput(this.ctx.utxo.value)

        assert(this.ctx.hashOutputs === hash256(outputs))

        assert(this.checkSig(signature, this.player))
    }

    @method()
    public deposit(value: bigint, reason: ByteString) {
        console.log('deposit', { value, reason })

        const outputs = this.buildStateOutput(this.ctx.utxo.value + value)

        assert(this.ctx.hashOutputs === hash256(outputs))
    }

    @method()
    public withdraw(value: bigint, reason: ByteString, signature: Sig) {
        console.log('withdraw', { value, reason, signature })

        const outputs = this.buildStateOutput(this.ctx.utxo.value - value)

        assert(this.ctx.hashOutputs === hash256(outputs))

        assert(this.checkSig(signature, this.player))
    }

    @method()
    public cancel(reason: ByteString, signature: Sig) {
        if (!this.checkSig(signature, this.player)) {
            assert(this.checkSig(signature, this.app))

            const outputs = Utils.buildPublicKeyHashOutput(
                hash160(this.player),
                this.ctx.utxo.value
            )

            assert(this.ctx.hashOutputs === hash256(outputs))
        }

        assert(true)
    }

    static cancelTxBuilder(
        current: DebitCard,
        options: MethodCallOptions<DebitCard>,
        ...args: any
    ): Promise<ContractTransaction> {

        const tx = new bsv.Transaction()
        tx.addInput(current.buildContractInput(options.fromUTXO))

        tx.addOutput(
            new bsv.Transaction.Output({
                script: Utils.buildPublicKeyHashScript(hash160(current.player)),
                satoshis: current.balance
            })
        )

        tx.change(privateKey.publicKey.toAddress())

        return Promise.resolve({
            tx: tx,
            atInputIndex: 0,
            nexts: []
        })

    }    

    static withdrawTxBuilder(): Promise<ContractTransaction> {
    }    

    static depositTxBuilder(): Promise<ContractTransaction> {
    }    

    static activateTxBuilder(): Promise<ContractTransaction> {
    }    

    static chargeTxBuilder(): Promise<ContractTransaction> {
    }

    static freezeTxBuilder(): Promise<ContractTransaction> {
    }    

}

