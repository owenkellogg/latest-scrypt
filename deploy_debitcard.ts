import { DebitCard } from './src/contracts/debitCard'
import {
    buildPublicKeyHashScript,
    hash160,
    findSig,
    MethodCallOptions,
    bsv,
    TestWallet,
    DefaultProvider,
    toByteString,
    ByteString,
    PubKey,
    ContractTransaction,
} from 'scrypt-ts'

import * as dotenv from 'dotenv'

// Load the .env file
dotenv.config()

const privateKey = bsv.PrivateKey.fromWIF(process.env.PRIVATE_KEY || '')

const player = new TestWallet(
    privateKey,
    new DefaultProvider({ network: bsv.Networks.mainnet })
)
const appPrivateKey = bsv.PrivateKey.fromWIF(process.env.PRIVATE_KEY_2 || '')

const app = new TestWallet(
    appPrivateKey,
    new DefaultProvider({ network: bsv.Networks.mainnet })
)

function bindDepositTxBuilder(instance: DebitCard) {
    instance.bindTxBuilder(
        'deposit',
        (
            current: DebitCard,
            options: MethodCallOptions<DebitCard>,
            amount: bigint,
            note: ByteString
        ): Promise<ContractTransaction> => {
            // create the next instance from the current
            const nextInstance = current.next()
            // apply updates on the next instance locally

            const tx = new bsv.Transaction()
            tx.addInput(current.buildContractInput(options.fromUTXO))

            tx.addOutput(
                new bsv.Transaction.Output({
                    script: nextInstance.lockingScript,
                    satoshis: current.balance + Number(amount),
                })
            )

            tx.change(privateKey.publicKey.toAddress())

            return Promise.resolve({
                tx: tx,
                atInputIndex: 0,
                nexts: [
                    {
                        instance: nextInstance,
                        balance: current.balance + Number(amount),
                        atOutputIndex: 0,
                    },
                ],
            })
        }
    )

    return instance
}

async function main() {
    await DebitCard.compile()

    const amount = parseInt(process.argv[4] || '1')

    const ownerAddress = process.argv[2] || privateKey.toPublicKey().toHex()

    const owner = PubKey(ownerAddress)

    const instance = new DebitCard(owner)

    // Connect to a player.
    await instance.connect(player)

    // Contract deployment.
    const deployTx = await instance.deploy(amount)

    console.log('DebitCard contract deployed: ', deployTx.id)

    bindDepositTxBuilder(instance)

    const { tx: depositTx } = await instance.methods.deposit(
        BigInt(10),
        toByteString('test deposit', true)
    )

    console.log({ depositTx: depositTx.id })

    const unlockable = DebitCard.fromTx(depositTx, 0)

    unlockable.connect(player)

    const { tx: unlockTx } = await unlockable.methods.unlock((sigResps) => {
        return findSig(sigResps, privateKey.publicKey)
    })

    console.log({ unlockTx: unlockTx.id })
}

main()
