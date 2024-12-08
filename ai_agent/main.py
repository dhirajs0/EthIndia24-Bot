from openai import OpenAI
from flask import Flask, request, jsonify
from openai.types.chat import ChatCompletionToolParam
import json

import os

app = Flask(__name__)

# Set your OpenAI API key from environment variable
api_key = os.getenv("OPENAI_API_KEY")


def save_user_details(first_name, last_name, email, phone_number):
    # Simulate saving the user details and return a response
    return {"first_name": first_name, "last_name": last_name, "email": email, "phone_number": phone_number}

# Define the function schema for OpenAI
tools = [
    {
        "type": "function",
        "function": {
            "name": "save_user_details",
            "description": "Saves the provided user details and returns a JSON response.",
            "parameters": {
                "type": "object",
                "properties": {
                    "first_name": {
                        "type": "string",
                        "description": "The first name of the user."
                    },
                    "last_name": {
                        "type": "string",
                        "description": "The last name of the user."
                    },
                    "email": {
                        "type": "string",
                        "description": "The email address of the user."
                    },
                    "phone_number": {
                        "type": "string",
                        "description": "The phone number of the user."
                    }
                },
                "required": ["first_name", "last_name", "email", "phone_number"]
            }
        }
    }
]

GPT_MODEL = "gpt-4o-mini"
client = OpenAI(api_key=api_key)

@app.route('/chat', methods=['POST'])
def chat():
    
    user_message = request.json.get('message', '')
    instructions = request.json.get('instructions', '')
    print(f"Instructions : {instructions}")
    print(f"User message: {user_message}")
    
    if not user_message:
        return jsonify({"error": "Message is required"}), 400

    response = client.chat.completions.create(
        model=GPT_MODEL,
        messages=[{"role": "system", "content": f"{instructions}"},
            {"role": "user", "content": user_message}],
        tools=tools
    )

    
    choice = response.choices[0]
    print(f"choice : {choice}")

    if choice.finish_reason == "tool_calls":
        # Extract the function call details
        tool_call = choice.message.tool_calls[0]
        function_name = tool_call.function.name
        function_args = json.loads(tool_call.function.arguments)
    
        # Check if the function exists in the global scope
        if function_name in globals():
            # Call the function dynamically with the provided arguments
            result = globals()[function_name](**function_args)
        else:
            result = {"error": f"Function '{function_name}' not implemented."}
    
        # Return the function's result
        return jsonify(result)

    # Step 2: Default response if no function call is triggered
    ai_reply = choice.message.content
    return jsonify({"reply": ai_reply})

if __name__ == "__main__":
    app.run(debug=True)