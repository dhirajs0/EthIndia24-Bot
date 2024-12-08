import { ApiPromise, WsProvider } from "@polkadot/api";
import { mnemonicGenerate } from "@polkadot/util-crypto";
import { Keyring } from "@polkadot/keyring";
import { saveToCache, getFromCache } from "../services/redisClient.js"; 
import { deploy } from "./deploy_meme_token.js";

const url = "wss://ws.test.azero.dev";
const wsProvider = new WsProvider(url); // Replace with your node's WebSocket URL
const api = await ApiPromise.create({ provider: wsProvider });
console.log("Connected to Polkadot chain.");

// Create a wallet for the user and store the mnemonic in Redis
export const createWallet = async (userId) => {
  try {
    const cacheMnemonic = await getFromCache(`wallet:${userId}:mnemonic`);
    if (cacheMnemonic) {
        return { ...(await getWallet(userId)), cached: true} ;
    }
    const mnemonic = mnemonicGenerate();
    const keyring = new Keyring();
    const pair = keyring.addFromMnemonic(mnemonic);
    const address = pair.address;
    console.log("Wallet created with address:", JSON.stringify(pair));
    // Store the mnemonic in Redis
    await saveToCache(`wallet:${userId}:mnemonic`, mnemonic);
    const cachedData = await getFromCache(`addressBook`);
    const existingContracts = cachedData ? JSON.parse(cachedData) : [];
    await saveToCache(`addressBook`, JSON.stringify([{ address, userId }, ...(existingContracts || [])]));
    await transferFunds(process.env.POLKADOT_MEMONICS, address);
    return { address }; // Return the address
  } catch (error) {
    console.error("Error creating wallet:", error);
    throw new Error("Failed to create wallet.");
  }
};

// Retrieve the wallet address for the user from Redis
export const getWallet = async (userId) => {
  try {
    const mnemonic = await getFromCache(`wallet:${userId}:mnemonic`);
    if (!mnemonic) {
      throw new Error("No wallet found for the user.");
    }

    const keyring = new Keyring();
    const pair = keyring.addFromMnemonic(mnemonic);
    return { address: pair.address, mnemonic };
  } catch (error) {
    console.error("Error retrieving wallet:", error);
    throw new Error("Failed to retrieve wallet.");
  }
};

export const transferFunds = async (mnemonic, recipientAddress, amount = 100_000_000_000_000) => {
    try {
      console.log("mnemonic: ", mnemonic);
  
      // Create keyring and add sender account from mnemonic
      const keyring = new Keyring();
      const sender = keyring.addFromMnemonic(mnemonic);
  
      // Transfer amount
      const transfer = api.tx.balances.transferKeepAlive(recipientAddress, amount);
  
      console.log(`Initiating transfer from ${sender.address} to ${recipientAddress} for amount ${amount}`);
  
      // Sign and send the transaction
      const hash = await transfer.signAndSend(sender, { nonce: -1 });
  
      console.log(`Transfer successful with hash: ${hash}`);
      return hash;
    } catch (error) {
      console.error("Error during transfer:", error);
      throw new Error("Transfer failed");
    } 
};

// Get ERC20 token balance from a contract
export const getBalance = async (address, contractAddress) => {
  try {

    // Query the contract for the token balance
    const { output } = await api.query.contracts.call(contractAddress, {
      gasLimit: -1,
      storageDepositLimit: null,
      inputData: {
        method: "balanceOf",
        args: [address],
      },
    });

    // Decode the output if it's a success
    if (output) {
      return output.toHuman();
    } else {
      throw new Error("Failed to retrieve balance.");
    }
  } catch (error) {
    console.error("Error retrieving balance:", error);
    throw new Error("Failed to retrieve balance.");
  } 
  
};

export const getNativeBalance = async (userId) => {
    try {
      // Connect to the Polkadot network

      const { address } = await getWallet(userId);
      // Query the balance information
      const { data: balance } = await api.query.system.account(address);
  
      console.log(`Balance retrieved for ${address}:`);
      console.log(`Free: ${balance.free}`);
      console.log(`Reserved: ${balance.reserved}`);
      console.log(`Misc Frozen: ${balance.miscFrozen}`);
      console.log(`Fee Frozen: ${balance.feeFrozen}`);
  
      // Return balance details
      return {
        free: balance.free?.toString(),
        reserved: balance.reserved?.toString(),
        miscFrozen: balance.miscFrozen?.toString(),
        feeFrozen: balance.feeFrozen?.toString(),
      };
    } catch (error) {
      console.error("Error fetching balance:", error);
      throw new Error("Failed to retrieve balance.");
    } 
};

export const deployMEMECoin = async (userId, name, symbol, token_uri, desc, total_supply) => {
    try {
        const { address, mnemonic } = await getWallet(userId);
        console.log("Deploying contract from address:", address);
        const contractAddress = await deploy(mnemonic, url, name, symbol, token_uri, desc, total_supply === '-' ? undefined: BigInt(total_supply));

        const cachedData = await getFromCache(`contracts:${userId}:erc20`);
        const existingContracts = cachedData ? JSON.parse(cachedData) : [];
        await saveToCache(`contracts:${userId}:erc20`, JSON.stringify([{contractAddress, name, symbol, desc}, ...(existingContracts || [])]));
        console.log("Deployed contract address:", contractAddress);
        return contractAddress;
    } catch (error) {
        console.error("Error deploying contract:", error);
        throw new Error("Failed to deploy contract.");
    }
}