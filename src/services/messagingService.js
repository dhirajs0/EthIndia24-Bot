import axios from "axios";
import { extractMessageFromReq, extractBusinessPhoneNumberIdFromReq } from "../utils/helpers.js";
import { createWallet, getWallet, transferFunds, getNativeBalance, deployMEMECoin } from "../utils/polkadot.js";
import { getFromCache, saveToCacheTTL} from "./redisClient.js";
import { mint } from "../utils/deploy_meme_token.js";
import OpenAI from 'openai';

export const processMessage = async (req) => {
    try {
        console.log("Webhook message: processMessage");
        const message = extractMessageFromReq(req);
        const msg = message?.text?.body;
        const command = (await getCommand(msg)).replace(/`/g, "");
        const userId = message.from;
        console.log("Command: ", command);
        console.log("Command Match: ", command === "/create_wallet");
        if (command === "/get_wallet") {
            // Handle get wallets
            console.log("Get wallets");
            const { address } = await getWallet(userId);
            console.log("Address: ", address);
            sendMessage(req, `Your wallet address is: ${address}`, userId);
        } else if (command === "/create_wallet") {
            // Handle create wallet
            console.log("Create wallet");
            const { address, cached } = await createWallet(userId);
            sendMessage(req, `${!cached ? 'Wallet created.' : 'Existing wallet found.'}\nYour address is: ${address}`, userId);
        } else if (command === "/get_balance") {
            // Handle get balance
            console.log("Get balance");
            const balance = await getNativeBalance(userId);
            sendMessage(req, `Your balance is: ${balance.free / 1000_000_000_000} AZERO`, userId);
        } else if (command.includes("/create_meme_coin")) {
            // Handle create meme coin
            console.log("Create meme coin");
            const attributes = command.split(" ");
            const name = attributes[1];
            const symbol = attributes[2];
            const tokenUri = attributes[3];
            const desc = attributes[4];
            const totalSupply = attributes[5];
            const contractAddress = await deployMEMECoin(userId, name, symbol, tokenUri, desc, totalSupply);
            const message = `🎉 *New Meme Coin Created!* 🎉
✅ *Name:* ${name}
✅ *Symbol:* ${symbol}
✅ *Token URI:* ${tokenUri}
✅ *Description:* ${desc}
✅ *Total Supply:* ${totalSupply}

🚀 *Contract Address:* ${contractAddress}

Enjoy your new meme coin journey! Let us know if you need assistance with anything else. 🎊`;
            sendMessage(req, message, userId);
        } else if (command.includes("/mint")) {
            // Handle send AZERO
            console.log("Mint meme tokens");
            const attributes = command.split(" ");
            const token = attributes[1] ?? "";
            let recipient = attributes[2] ?? 0;
            const wallet = await getWallet(userId);
            const userTokens = await getFromCache(`contracts:${userId}:erc20`);
            const tokens = userTokens ? JSON.parse(userTokens) : [];
            const tokenAddress = tokens.find((item) => item.name === token || item.symbol === token || item.contractAddress === token)?.contractAddress;    
            if (recipient.length < 15) {
                const addresses = await getFromCache(`addressBook`);
                const addressBook = addresses ? JSON.parse(addresses) : [];
                recipient = addressBook.find((address) => address.userId === recipient)?.address;
                if (!recipient) {
                    sendMessage(req, "Recipient no. not found. Please provide a valid recipient address or mobile number.");
                    return;
                }
            }
            if (!tokenAddress) {
                sendMessage(req, "Token not found. Please provide a valid token name, symbol or contract address.");
                return;
            }
            await mint(wallet.mnemonic, tokenAddress, recipient);
            sendMessage(req, `Minted 1 ${token} to ${recipient}`, userId);
        } else if (command.includes("/send_azero")) {
            // Handle send AZERO
            console.log("Send AZERO");
            const attributes = command.split(" ");
            let recipient = attributes[1] ?? "";
            const amount = attributes[2] ?? 0;
            const wallet = await getWallet(userId);
            if (recipient.length < 13) {
                const addresses = await getFromCache(`addressBook`);
                const addressBook = addresses ? JSON.parse(addresses) : [];
                recipient = addressBook.find((address) => address.userId === recipient)?.address;
                if (!recipient) {
                    sendMessage(req, "Recipient no. not found. Please provide a valid recipient address or mobile number.");
                    return;
                }
            }
            const hash = await transferFunds(wallet.mnemonic, recipient, amount * 1000_000_000_000);
            const url = `https://alephzero-testnet.subscan.io/extrinsic/${hash}`;
            sendMessage(req, `Transfer of ${amount} Azero was successful. View details: ${url}`, userId);
        } else {
            console.log("Incoming message not matched", msg);
            sendMessage(req, "I'm sorry, I didn't understand that. Please try again.", userId);
        }
    } catch (err) {
        console.error("Error processing message:", err);
        sendMessage(req, "An error occurred while processing your request. Please try again later.");
    }
};


//name, symbol, token_uri, desc, total_supply
const getCommand = async (msg) => {
    const GPT_MODEL = "gpt-4o";
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        console.error("OPENAI_API_KEY is not set in the environment variables.");
        process.exit(1);
    }

    const openai = new OpenAI({
        apiKey,
      });

    const requestData = {
        message: msg,
        instructions: `You are a command interpretation assistant. Given a user input, you must decide which command the user intends to execute from the following list:

            1. /get_wallet - To get existing wallets the user already has.
            2. /create_wallet - To create a new wallet.
            3. /create_meme_coin {name} {symbol} {tokenUri} {desc} {supply} - To create a new meme coin.
            4. /get_balance - To get the balance of native token.
            5. /send_azero {address/mobile_number} {amount} - To send AZERO tokens to another address.
            6. /mint {memeTokenAddress/name/symbol} {beneficiary_address/mobile_number} - To mint tokens for a meme coin.

            ### Rules:
            - Analyze the user's input.
            - If it clearly aligns with one of the commands, output only the command text (e.g., /get_wallet).
            - If the intent is unclear or does not match any command, output \`undefined\`.
            - For the /create_meme_coin command, if any of the following are missing (\`name\`, \`symbol\`, \`tokenUri\`, \`desc\`, \`supply\`), suggest a random name and symbol, and fill in the others with a \`-\` (for example, \`/create_meme_coin {name} {symbol} - - -\`) to complete the command.
            - Ensure there are always 5 space-separated items in the output for /create_meme_coin command.
            - Commands are case sensitive and are in lowercase always and always start with a \`/\`.

            ### Example Inputs and Outputs:

            - **Input:** 'Show me my wallets.'
            - **Output:** /get_wallet

            - **Input:** 'I want to create a wallet.'
            - **Output:** /create_wallet

            - **Input:** 'How do I start a funny crypto token?'
            - **Output:** /create_meme_coin - - - -

            - **Input:** 'Create a meme coin called DogeCoin with symbol DOGE and supply 1000000.'
            - **Output:** /create_meme_coin DogeCoin DOGE - - 1000000

            - **Input:** 'I want to make a meme coin with symbol DOGE.'
            - **Output:** /create_meme_coin - DOGE - - -

            - **Input:** 'What's the balance of my native token?'
            - **Output:** /get_balance

            - **Input:** 'How can I make a meme coin with a random name and symbol?'
            - **Output:** /create_meme_coin - - - -

            - **Input:** 'Tell me something else.'
            - **Output:** undefined

            - **Input:** 'I want to send 100 AZERO to 916265832925.'
            - **Output:** /send_azero 916265832925 100

            - **Input:** 'I want to send 100 AZERO to 5CJjoWpSNF926dykJxmGPRtrCuuV8pGin2xrL51stxUJCmMe.'
            - **Output:** /send_azero 5CJjoWpSNF926dykJxmGPRtrCuuV8pGin2xrL51stxUJCmMe 100

            - **Input:** 'I want to mint SAYA tokens for 916265832925.'
            - **Output:** /mint SAYA 916265832925

            - **Input:** 'I want to mint SAYA tokens for 5CJjoWpSNF926dykJxmGPRtrCuuV8pGin2xrL51stxUJCmMe.'
            - **Output:** /mint SAYA 5CJjoWpSNF926dykJxmGPRtrCuuV8pGin2xrL51stxUJCmMe

            Now, process the input and provide the output.`,
    };

    try {
        const response = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: requestData.instructions || '' },
                { role: 'user', content: msg || '' }
            ],
            model: 'gpt-4o',
        });
        const choice = response.choices[0];
        const aiReply = choice.message.content;
        return aiReply;
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return "Internal Server Error";
    }
}

export const markAsRead = async (req) => {
    console.log("Webhook message: markAsRead");
    const businessPhoneNumberId = extractBusinessPhoneNumberIdFromReq(req);
    const message = extractMessageFromReq(req);

    await axios({
        method: "POST",
        url: `https://graph.facebook.com/v18.0/${businessPhoneNumberId}/messages`,
        headers: {
            Authorization: `Bearer ${process.env.GRAPH_API_TOKEN}`,
        },
        data: {
            messaging_product: "whatsapp",
            status: "read",
            message_id: message.id,
        },
    });
};

export const sendMessage = async (req, textMessage, userId) => { 
    const message = extractMessageFromReq(req);
    const businessPhoneNumberId =
        extractBusinessPhoneNumberIdFromReq(req) || process.env.BUSINESS_PHONE_NO_ID;
    const today = new Date().toISOString().split('T')[0];
    let count = parseInt(await getFromCache(`message_count${today}`)) || 0;
    if (count >= 1000) {
        console.log("Message limit reached");
        return;
    }
    count++;
    await saveToCacheTTL(`message_count${today}`, count.toString());
    await axios({
        method: "POST",
        url: `https://graph.facebook.com/v18.0/${businessPhoneNumberId}/messages`,
        headers: {
            Authorization: `Bearer ${process.env.GRAPH_API_TOKEN}`,
        },
        data: {
            messaging_product: "whatsapp",
            to: message?.from || userId,
            text: { body: textMessage },
            ...(message?.id && {
                context: {
                    message_id: message.id,
                },
            }),
        },
    });
};
