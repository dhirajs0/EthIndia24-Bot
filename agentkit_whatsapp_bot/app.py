import os
import sys
import time
from flask import Flask, request, jsonify
from twilio.twiml.messaging_response import MessagingResponse
from twilio.rest import Client

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent
from cdp_langchain.agent_toolkits import CdpToolkit
from cdp_langchain.utils import CdpAgentkitWrapper

app = Flask(__name__)

# Twilio credentials (set as environment variables or hardcode for testing)
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID",
                                    "YOUR_TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN",
                                   "YOUR_TWILIO_AUTH_TOKEN")

# This should be your Twilio WhatsApp number: "whatsapp:+14155238886" is the Twilio Sandbox number.
TWILIO_WHATSAPP_NUMBER = "whatsapp:+14155238886"

wallet_data_file = "wallet_data.txt"
agent_executor = None
config = None


def initialize_agent():
    """Initialize the agent with CDP Agentkit."""
    llm = ChatOpenAI(model="gpt-4o-mini")

    wallet_data = None
    if os.path.exists(wallet_data_file):
        with open(wallet_data_file) as f:
            wallet_data = f.read()

    values = {}
    if wallet_data is not None:
        values = {"cdp_wallet_data": wallet_data}

    agentkit = CdpAgentkitWrapper(**values)

    # persist the agent's CDP MPC Wallet Data.
    wallet_data = agentkit.export_wallet()
    with open(wallet_data_file, "w") as f:
        f.write(wallet_data)

    cdp_toolkit = CdpToolkit.from_cdp_agentkit_wrapper(agentkit)
    tools = cdp_toolkit.get_tools()

    memory = MemorySaver()
    config = {"configurable": {"thread_id": "CDP Agentkit Chatbot Example!"}}

    agent_executor = create_react_agent(
        llm,
        tools=tools,
        checkpointer=memory,
        state_modifier=
        ("You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. "
         "You are empowered to interact onchain using your tools. If you ever need funds, you can request "
         "them from the faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet "
         "details and request funds from the user. Before executing your first action, get the wallet details "
         "to see what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try "
         "again later. If someone asks you to do something you can't do with your currently available tools, "
         "you must say so, and encourage them to implement it themselves using the CDP SDK + Agentkit, "
         "recommend they go to docs.cdp.coinbase.com for more information. Be concise and helpful with your "
         "responses."),
    )

    return agent_executor, config

@app.route("/", methods=["GET"])
def home():
    """Simple health check endpoint."""
    return jsonify({"status": "server is up"}), 200

@app.route("/health", methods=["GET"])
def health_check():
    """Simple health check endpoint."""
    return jsonify({"status": "ok"}), 200


@app.route("/whatsapp", methods=["POST"])
def whatsapp_webhook():
    """Handle incoming WhatsApp messages from Twilio."""
    incoming_msg = request.form.get("Body", "").strip()
    sender = request.form.get("From", "")
    print(f"Received message from {sender}: {incoming_msg}")
    if not incoming_msg:
        resp = MessagingResponse()
        resp.message("I didn't receive any input. Please try again.")
        return str(resp)

    # Run agent with the user's input in chat mode
    # The agent's stream returns a generator that yields chunks of content
    response_text = ""
    for chunk in agent_executor.stream(
        {"messages": [HumanMessage(content=incoming_msg)]}, config):
        if "agent" in chunk:
            response_text += chunk["agent"]["messages"][0].content + "\n"
        elif "tools" in chunk:
            # Tool messages (if any) are usually not meant to be shown directly to users.
            # You could choose to print them or log them.
            pass

    # Trim whitespace and respond
    response_text = response_text.strip(
    ) if response_text else "Sorry, I have no response."
    resp = MessagingResponse()
    resp.message(response_text)
    return str(resp)

if __name__ == "__main__":
    # Initialize the agent globally so it is ready when messages come in
    agent_executor, config = initialize_agent()
    
    # Run the Flask app
    app.run(host="0.0.0.0", port=5000, debug=True)


