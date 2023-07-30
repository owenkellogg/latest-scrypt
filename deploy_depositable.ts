import { Depositable } from './src/contracts/depositable'
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

function bindDepositTxBuilder(instance: Depositable) {
    instance.bindTxBuilder(
        'deposit',
        (
            current: Depositable,
            options: MethodCallOptions<Depositable>,
            amount: bigint,
            note: ByteString
        ): Promise<ContractTransaction> => {
            // create the next instance from the current
            const nextInstance = current.next()
            // apply updates on the next instance locally

            const tx = new bsv.Transaction()
            tx.addInput(current.buildContractInput(options.fromUTXO)).addOutput(
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
    await Depositable.compile()

    const amount = parseInt(process.argv[4] || '1')

    const ownerAddress = process.argv[2] || privateKey.toPublicKey().toHex()

    const owner = PubKey(ownerAddress)

    const instance = new Depositable(owner)

    // Connect to a signer.
    await instance.connect(signer)

    // Contract deployment.
    const deployTx = await instance.deploy(amount)

    console.log('Depositable contract deployed: ', deployTx.id)

    bindDepositTxBuilder(instance)

    const { tx: depositTx } = await instance.methods.deposit(
        BigInt(10),
        toByteString('test deposit', true)
    )

    console.log({ depositTx: depositTx.id })

    const unlockable = Depositable.fromTx(depositTx, 0)

    unlockable.connect(signer)

    const { tx: unlockTx } = await unlockable.methods.unlock((sigResps) => {
        return findSig(sigResps, privateKey.publicKey)
    })

    console.log({ unlockTx: unlockTx.id })
}

main()
