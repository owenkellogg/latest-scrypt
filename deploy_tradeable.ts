import { Tradeable } from './src/contracts/tradeable'
import {
    buildPublicKeyHashScript,
    hash160,
    findSig,
    MethodCallOptions,
    bsv,
    TestWallet,
    DefaultProvider,
    toByteString,
    PubKey,
    ContractTransaction,
} from 'scrypt-ts'

import * as dotenv from 'dotenv'

// Load the .env file
dotenv.config()

// Read the private key from the .env file.
// The default private key inside the .env file is meant to be used for the Bitcoin testnet.
// See https://scrypt.io/docs/bitcoin-basics/bsv/#private-keys
const privateKey = bsv.PrivateKey.fromWIF(process.env.PRIVATE_KEY || '')

// Prepare signer.
// See https://scrypt.io/docs/how-to-deploy-and-call-a-contract/#prepare-a-signer-and-provider
const signer = new TestWallet(
    privateKey,
    new DefaultProvider({ network: bsv.Networks.mainnet })
)

async function main() {
    await Tradeable.compile()

    const amount = parseInt(process.argv[4] || '1')

    const ownerAddress = process.argv[2] || privateKey.toPublicKey().toHex()

    const owner = PubKey(ownerAddress)

    const instance = new Tradeable(
        toByteString('some great content', true),
        owner,
        0n
    )

    // Connect to a signer.
    await instance.connect(signer)

    // Contract deployment.
    const deployTx = await instance.deploy(amount)

    console.log('Tradeable contract deployed: ', deployTx.id)

    let nextInstance = instance.next()

    nextInstance.ask = 2n

    const { tx: callTx } = await instance.methods.setAsk(
        2n,
        (sigResps) => {
            return findSig(sigResps, privateKey.publicKey)
        },
        {
            pubKeyOrAddrToSign: privateKey.publicKey.toAddress(),
            next: {
                instance: nextInstance,
                //@ts-ignore
                balance: instance.balance,
            },
        } as MethodCallOptions<Tradeable>
    )

    console.log('Tradeable contract called: ', callTx.id)

    const tradeable = Tradeable.fromTx(callTx, 0).next()

    tradeable.bindTxBuilder(
        'placeBid',
        (
            current: Tradeable,
            options: MethodCallOptions<Tradeable>,
            bid: bigint,
            bidder: PubKey
        ): Promise<ContractTransaction> => {
            console.log('from utxo', options.fromUTXO)
            // create the next instance from the current
            const nextInstance = current.next()
            // apply updates on the next instance locally
            nextInstance.bidder = bidder

            nextInstance.bid = bid

            const tx = new bsv.Transaction()
            tx.addInput(current.buildContractInput(options.fromUTXO))
                .addOutput(
                    new bsv.Transaction.Output({
                        script: nextInstance.lockingScript,
                        satoshis: current.balance + Number(nextInstance.bid),
                    })
                )

            tx.change(privateKey.publicKey.toAddress())

            const nextBalance = current.balance + Number(nextInstance.bid)

            console.log('next balance', nextBalance)

            return Promise.resolve({
                tx: tx,
                atInputIndex: 0,
                nexts: [
                    {
                        instance: nextInstance,
                        balance: nextBalance,
                        atOutputIndex: 0,
                    },
                ],
            })
        }
    )

    console.log('AFTER BUILDER')

    tradeable.connect(signer)

    const { tx: bidTx } = await tradeable.methods.placeBid(
        1n,
        PubKey(privateKey.publicKey.toString())
    )

    console.log({ bidTx: bidTx.id })

    const thirdInstance = Tradeable.fromTx(bidTx, 0)

    thirdInstance.connect(signer)

    const { tx: removeTx } = await thirdInstance.methods.remove((sigResps) => {
        return findSig(sigResps, privateKey.publicKey)
    })

    console.log({ removeTx: removeTx.id })
}

main()
