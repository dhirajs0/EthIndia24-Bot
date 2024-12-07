import { Keyring } from '@polkadot/keyring'
import { LegacyClient, WsProvider } from 'dedot'
import { ContractDeployer } from 'dedot/contracts'
import { stringToHex } from 'dedot/utils'
import dotenv from 'dotenv'
import { readFile } from 'fs/promises'

dotenv.config();

async function deploy(name, symbol, token_uri, desc, total_supply) {
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

  // create a ContractDeployer instance
  const wasm = await readFile(WASM_PATH)
  const abi = JSON.parse(await readFile(ABI_PATH,'utf-8'))
  const deployer = new ContractDeployer(
    client, 
    abi,
    wasm
  )

  // Dry run the constructor call for validation and gas estimation
  const signer = new Keyring().createFromUri(DEPLOYER_KEY)
  const salt = stringToHex(""+Math.random())
  const { raw } = await deployer.query.new(name, symbol, token_uri, desc, total_supply, { caller: signer.address, salt })

  // Submitting the transaction to instanciate the contract
  let contractAddress
  await deployer.tx.new(name, symbol, token_uri, desc, total_supply, { gasLimit: raw.gasRequired, salt })
  .signAndSend(signer, ({ status, events}) => { 
    if (status.type === 'Finalized') {
      const instantiatedEvent = client.events.contracts.Instantiated.find(events)
      contractAddress = instantiatedEvent?.palletEvent.data.contract.address()
    }    
  });

  const waitForResponse = () => {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (contractAddress !== undefined) {
          clearInterval(interval)
          resolve(contractAddress)
        }
      }, 1000)
    })
  }

  return waitForResponse()
}

// deploy("name", "symbol", "token_uri", "desc", BigInt(10))
//   .then((contractAddress) => {
//     console.log("Deployed address for MemeToken contract:", contractAddress)
//   })
//   .catch((error) => {
//     console.error(error)
//     process.exit(1)
//   })
//   .finally(() => process.exit(0))
