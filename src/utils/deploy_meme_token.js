import { Keyring } from '@polkadot/keyring'
import { LegacyClient, WsProvider } from 'dedot'
import { ContractDeployer } from 'dedot/contracts'
import { stringToHex } from 'dedot/utils'
import { readFile } from 'fs/promises'
import { Contract } from 'dedot/contracts'


export async function deploy(deployer_key, rpc_url, name, symbol, token_uri, desc, total_supply = BigInt(1000000)) {
  // Destructure environment variables
  const {
    WASM_PATH,
    ABI_PATH,
  } = process.env
  if (
    !WASM_PATH ||
    !ABI_PATH
  ) {
    throw new Error('Missing environment variables')
  }

  // instanciate an api client
  const provider = new WsProvider(rpc_url)
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
  const signer = new Keyring().createFromUri(deployer_key)
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

export async function mint(deployer_key, memeTokenAddress, beneficiary) {
    console.log('Minting MEME token', memeTokenAddress, 'to', beneficiary)
    // Destructure environment variables
    const {
      WASM_PATH,
      ABI_PATH,
    } = process.env
    if (
      !WASM_PATH ||
      !ABI_PATH
    ) {
      throw new Error('Missing environment variables')
    }
    const rpc_url = "wss://ws.test.azero.dev";

    // instanciate an api client
    const provider = new WsProvider(rpc_url)
    const client = await LegacyClient.new({
        provider,
        cacheMetadata: false,
    })
  
    // create a Contract instance
    const abi = JSON.parse(await readFile(ABI_PATH,'utf-8'))
    const contract = new Contract(client, abi, memeTokenAddress)
  
    // Dry run
    const signer = new Keyring().createFromUri(deployer_key)
    const { raw } = await contract.query.mint(beneficiary, { caller: signer.address })
  
    await contract.tx.mint(beneficiary, { gasLimit: raw.gasRequired })
    .signAndSend(signer, ({ status, events}) => { 
      if (status.type === 'BestChainBlockIncluded' || status.type === 'Finalized') {
        const transferEvent = contract.events["erc20::erc20::Transfer"].find(events);
        console.log('EVENT --> ', transferEvent.name);
      }    
    });
}