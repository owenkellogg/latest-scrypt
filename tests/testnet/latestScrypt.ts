import { LatestScrypt } from '../../src/contracts/latestScrypt'
import { getDefaultSigner, inputSatoshis } from '../utils/txHelper'
import { toByteString, sha256 } from 'scrypt-ts'

const message = 'hello world, sCrypt!'

async function main() {
    await LatestScrypt.compile()
    const instance = new LatestScrypt(sha256(toByteString(message, true)))

    // connect to a signer
    await instance.connect(getDefaultSigner())

    // contract deployment
    const deployTx = await instance.deploy(inputSatoshis)
    console.log('LatestScrypt contract deployed: ', deployTx.id)

    // contract call
    const { tx: callTx } = await instance.methods.unlock(
        toByteString(message, true)
    )
    console.log('LatestScrypt contract `unlock` called: ', callTx.id)
}

describe('Test SmartContract `LatestScrypt` on testnet', () => {
    it('should succeed', async () => {
        await main()
    })
})
