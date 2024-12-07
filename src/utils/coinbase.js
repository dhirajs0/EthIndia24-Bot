import Coinbase, { Wallet } from '@coinbase/coinbase-sdk';


export const create_wallet = async () => {
    let wallet = await Wallet.create();
    let address = await wallet.getDefaultAddress();
    console.log(`Wallet created with address: ${address}`);
    return {
        address,
        walletExport: wallet.export()
    }
}

console.log("Coinbase initialized successfully.", create_wallet());

