# WhatsApp Crypto AI Agent

A WhatsApp-based AI Agent that can interact with cryptocurrency platforms using the Coinbase Developer Platform (CDP) AgentKit.

## Features

- WhatsApp message handling via Twilio
- Integration with CDP AgentKit for crypto operations
- Automated responses using LangChain and GPT-4
- Secure wallet management
- Flask-based webhook server

## Setup

1. Clone the repository
2. Install dependencies:

   ```bash
   pip install -r requirements.txt

   ```

3. Set environment variables:

   - CDP_API_KEY_NAME
   - CDP_API_KEY_PRIVATE_KEY
   - OPENAI_API_KEY
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN

4. Run the server:
   - python chatbot.py

## Configuration

    The bot uses the following port:
    - Flask server: Port 5000

## Dependencies

    - LangChain
    - OpenAI GPT-4
    - CDP AgentKit
    - Flask
    - Twilio

### Security

    - Wallet data is stored locally.
    - Implements CDP's secure wallet management.
    - Uses environment variables for sensitive credentials.

### Screenshots

<!-- <img src="/agentkit_whatsapp_bot/img/screenshot-actions.jpeg" alt="onchain actions" width="500"> -->
![Screenshot Description](/agentkit_whatsapp_bot/img/screenshot.jpeg)
![Screenshot Description](/agentkit_whatsapp_bot/img/screenshot-actions.jpeg)
