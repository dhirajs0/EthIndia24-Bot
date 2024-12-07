import { Keyring } from '@polkadot/keyring'
import { LegacyClient, WsProvider } from 'dedot'
import dotenv from 'dotenv'

dotenv.config();

async function faucet(beneficiary, amount) {
  // Destructure environment variables
  const {
    DEPLOYER_KEY,
    RPC_URL
  } = process.env
  if (
    !DEPLOYER_KEY ||
    !RPC_URL
  ) {
    throw new Error('Missing environment variables')
  }

  // instanciate an api client
  const provider = new WsProvider(RPC_URL)
  const client = await LegacyClient.new({
      provider,
      cacheMetadata: false,
  })

  const signer = new Keyring().createFromUri(DEPLOYER_KEY)

  const unsub = await client.tx.balances
    .transferKeepAlive(beneficiary, amount)
    .signAndSend(signer, async ({ status }) => {
      console.log('Transaction status', status.type);
      if (status.type === 'BestChainBlockIncluded') { // or status.type === 'Finalized'
        console.log(`Transaction completed at block hash ${status.value.blockHash}`);
        await unsub();
      }
    });
}

// faucet("5FdrXPKzV7JMYtG5k8L2e6vLzTqdvKhH7j2149A8kVDYZ6KB", 2_000_000_000_000n)
//   .then(() => {
//     console.log("Successfully transferred")
//   })
//   .catch((error) => {
//     console.error(error)
//     process.exit(1)
//   })
//   .finally(() => process.exit(0))
