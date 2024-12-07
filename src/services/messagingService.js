import axios from "axios";
import { extractMessageFromReq, extractBusinessPhoneNumberIdFromReq } from "../utils/helpers.js";
import { createWallet, getWallet, getBalance, getNativeBalance } from "../utils/polkadot.js";

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
        } else if (command === "/create_meme_coin") {
            // Handle create meme coin
            console.log("Create meme coin");
            sendMessage(req, "Create meme coin", userId);
        } else {
            console.log("Incoming message not matched", msg);
        }
    } catch (err) {
        sendMessage(req, "An error occurred while processing your request. Please try again later.");
    }
};

const getCommand = async (msg) => {
    const apiUrl = 'https://508d-14-195-142-82.ngrok-free.app/chat';

    const requestData = {
        message: msg,
        instructions: `You are a command interpretation assistant. Given a user input, you must decide which command the user intends to execute from the following list:

        1. "/get_wallet" - To get existing wallets the user already has.
        2. "/create_wallet" - To create a new wallet.
        3. "/create_meme_coin" - To create a new meme coin.
        4. "/get_balance" - To get the balance of native token.

        Rules:
        - Analyze the user's input.
        - If it clearly aligns with one of the commands, output only the command text (e.g., \`/get_wallets\`).
        - If the intent is unclear or does not match any command, output \`undefined\`.
        - Do not provide explanations or additional information; only output the command or \`undefined\`.

        Example inputs and outputs:
        - Input: "Show me my wallets." -> Output: \`/get_wallets\`
        - Input: "I want to make a wallet." -> Output: \`/create_wallet\`
        - Input: "How do I start a funny crypto token?" -> Output: \`/create_meme_coin\`
        - Input: "Tell me something else." -> Output: \`undefined\`

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
