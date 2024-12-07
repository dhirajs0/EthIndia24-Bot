import { Keyring } from '@polkadot/keyring'
import { LegacyClient, WsProvider } from 'dedot'
import { Contract } from 'dedot/contracts'
import dotenv from 'dotenv'
import { readFile } from 'fs/promises'

dotenv.config();

async function mint(memeTokenAddress, beneficiary) {
  // Destructure environment variables
  const {
    DEPLOYER_KEY,
    RPC_URL,
    WASM_PATH,
    ABI_PATH,
  } = process.env
  if (
    !DEPLOYER_KEY ||
    !RPC_URL ||
    !WASM_PATH ||
    !ABI_PATH
  ) {
    throw new Error('Missing environment variables')
  }

  // instanciate an api client
  const provider = new WsProvider(RPC_URL)
  const client = await LegacyClient.new({
      provider,
      cacheMetadata: false,
  })

  // create a Contract instance
  const abi = JSON.parse(await readFile(ABI_PATH,'utf-8'))
  const contract = new Contract(client, abi, memeTokenAddress)

  // Dry run
  const signer = new Keyring().createFromUri(DEPLOYER_KEY)
  const { raw } = await contract.query.mint(beneficiary, { caller: signer.address })

  // Submitting the transaction to instanciate the contract
  await contract.tx.mint(beneficiary, { gasLimit: raw.gasRequired })
  .signAndSend(signer, ({ status, events}) => { 
    if (status.type === 'BestChainBlockIncluded' || status.type === 'Finalized') {
      const transferEvent = contract.events["erc20::erc20::Transfer"].find(events);
      console.log('EVENT --> ', transferEvent.name);
    }    
  });
}

// mint("5CcWSwwzEjws5HLNbGVDbkHDRY4P1dBxV4PJFSw9MTR1gyDa", "5FdrXPKzV7JMYtG5k8L2e6vLzTqdvKhH7j2149A8kVDYZ6KB")
//   .then(() => {
//     console.log("Successfully minted")
//   })
//   .catch((error) => {
//     console.error(error)
//     process.exit(1)
//   })
//   .finally(() => process.exit(0))
