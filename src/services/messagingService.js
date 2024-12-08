import axios from "axios";
import { extractMessageFromReq, extractBusinessPhoneNumberIdFromReq } from "../utils/helpers.js";
import { createWallet, getWallet, getBalance, getNativeBalance, deployMEMECoin } from "../utils/polkadot.js";

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
            sendMessage(req, `${!cached ? 'Wallet created.' : ''}\nYour address is: ${address}`, userId);
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
        } else {
            console.log("Incoming message not matched", msg);
        }
    } catch (err) {
        console.error("Error processing message:", err);
        sendMessage(req, "An error occurred while processing your request. Please try again later.");
    }
};

//name, symbol, token_uri, desc, total_supply
const getCommand = async (msg) => {
    const apiUrl = 'https://0989-14-195-142-82.ngrok-free.app/chat';

    const requestData = {
        message: msg,
        instructions: `You are a command interpretation assistant. Given a user input, you must decide which command the user intends to execute from the following list:

            1. /get_wallet - To get existing wallets the user already has.
            2. /create_wallet - To create a new wallet.
            3. /create_meme_coin {name} {symbol} {tokenUri} {desc} {supply} - To create a new meme coin.
            4. /get_balance - To get the balance of native token.

            ### Rules:
            - Analyze the user's input.
            - If it clearly aligns with one of the commands, output only the command text (e.g., /get_wallet).
            - If the intent is unclear or does not match any command, output \`undefined\`.
            - For the /create_meme_coin command, if any of the following are missing (\`name\`, \`symbol\`, \`tokenUri\`, \`desc\`, \`supply\`), suggest a random name and symbol, and fill in the others with a \`-\` (for example, \`/create_meme_coin {name} {symbol} - - -\`) to complete the command.
            - Ensure there are always 5 space-separated items in the output.

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

            Now, process the input and provide the output.`,
    };

    const response = await axios.post(apiUrl, requestData, {
        headers: {
            'Content-Type': 'application/json',
        },
    });
    return response.data.reply;
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
