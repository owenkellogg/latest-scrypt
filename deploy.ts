import { Sellable } from './src/contracts/sellable'
import {
    bsv,
    TestWallet,
    DefaultProvider,
    MethodCallOptions,
    sha256,
    toByteString,
    PubKeyHash,
    Ripemd160,
    findSig,
    PubKey,
} from 'scrypt-ts'

import { decode } from 'bs58'

import * as dotenv from 'dotenv'

// Load the .env file
dotenv.config()

// Read the private key from the .env file.
// The default private key inside the .env file is meant to be used for the Bitcoin testnet.
// See https://scrypt.io/docs/bitcoin-basics/bsv/#private-keys
const privateKey = bsv.PrivateKey.fromWIF(process.env.PRIVATE_KEY || '')

class Wallet extends TestWallet {
    get network() {
        return bsv.Networks.livenet
    }
}

const provider = new DefaultProvider()

// Prepare signer.
// See https://scrypt.io/docs/how-to-deploy-and-call-a-contract/#prepare-a-signer-and-provider
const signer = new Wallet(privateKey, provider)

async function main() {
    await Sellable.compile()

    // TODO: Adjust the amount of satoshis locked in the smart contract:
    const amount = 100

    const price = 5000n

    const publicKey = privateKey.publicKey

    const instance = new Sellable(
        toByteString('deep-learningg', true),
        PubKey(publicKey.toString()),
        price
    )

    const network = await provider.getNetwork()

    console.log({ network })

    // Connect to a signer.
    await instance.connect(signer)

    // Contract deployment.
    const deployTx = await instance.deploy(amount)
    console.log(`Sellable contract deployed: ${deployTx.id}`)

    try {
        const nextInstance = instance.next()

        const { tx: setPriceTx } = await instance.methods.setPrice(
            100n,
            (sigResponses: any) => {
                return findSig(sigResponses, publicKey)
            },
            {
                pubKeyOrAddrToSign: publicKey.toAddress(),
                next: {
                    instance: nextInstance,
                    //@ts-ignore
                    balance: instance.balance,
                },
            } as MethodCallOptions<Sellable>
        )

        console.log('setPrice.tx', setPriceTx.hash)
    } catch (error) {
        console.error(error)
    }

    const { tx } = await instance.methods.unlock((sigResponses: any) => {
        return findSig(sigResponses, publicKey)
    })

    console.log('remove.tx', tx.hash)
}

main()
