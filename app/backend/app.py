import logging
import os
import re
import json
from pathlib import Path

from aiohttp import web
from azure.core.credentials import AzureKeyCredential
from azure.identity import AzureDeveloperCliCredential, DefaultAzureCredential
from dotenv import load_dotenv

from ragtools import attach_rag_tools
from rtmt import RTMiddleTier

from openai import AzureOpenAI

load_dotenv()

api_base = os.getenv("AZURE_OPENAI_GPT40_ENDPOINT")
api_key= os.getenv("AZURE_OPENAI_API_KEY")
deployment_name = os.getenv("AZURE_OPENAI_GPT4O_DEPLOYMENT")
api_version = os.getenv("AZURE_OPENAI_VERSION") 


client = AzureOpenAI(
    api_key=api_key,  
    api_version=api_version,
    base_url=f"{api_base}/openai/deployments/{deployment_name}"
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voicerag")

# Define the function schema with the new fields
functions = [
    {
        "name": "analyze_call",
        "description": "Analyze the call and return structured JSON analytics.",
        "parameters": {
            "type": "object",
            "properties": {
                "callSummary": {
                    "type": "string",
                    "description": "A brief summary of the call."
                },
                "customerIntent": {
                    "type": "object",
                    "properties": {
                        "mainIntent": {
                            "type": "string",
                            "description": "Primary reason the customer contacted support."
                        },
                        "secondaryIntents": {
                            "type": "array",
                            "items": { "type": "string" },
                            "description": "Any secondary reasons or requests."
                        }
                    },
                    "required": ["mainIntent", "secondaryIntents"]
                },
                "sentiment": {
                    "type": "object",
                    "properties": {
                        "customerSentimentLabel": {"type": "string"},
                        "customerSentimentScore": {"type": "number"},
                        "agentSentimentLabel": {"type": "string"},
                        "agentSentimentScore": {"type": "number"}
                    },
                    "required": ["customerSentimentLabel", "customerSentimentScore", "agentSentimentLabel", "agentSentimentScore"]
                },
                "keyTopics": {
                    "type": "array",
                    "items": { "type": "string" }
                },
                "callResolution": {
                    "type": "string",
                    "description": "resolved, unresolved, or pending follow-up."
                },
                "compliance": {
                    "type": "string",
                    "description": "Compliance status or 'unknown'."
                },
                "escalation": {
                    "type": "string",
                    "description": "yes/no if the call was escalated."
                },
                "complexityScore": {
                    "type": "number",
                    "description": "Complexity 1-10"
                },
                "intentConfidence": {
                    "type": "number",
                    "description": "Confidence 1-10 in identifying main intent."
                },
                "keyPhrases": {
                    "type": "object",
                    "properties": {
                        "problems": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Key phrases that highlight customer-reported problems or issues."
                        },
                        "resolutions": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Key phrases indicating resolutions or solutions provided."
                        },
                        "needsReview": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Key phrases that might require human review or follow-up."
                        }
                    },
                    "required": ["problems", "resolutions", "needsReview"]
                }
            },
            "required": [
                "callSummary", "customerIntent", "sentiment",
                "keyTopics", "callResolution", "compliance",
                "escalation", "complexityScore", "intentConfidence",
                "keyPhrases"
            ]
        }
    }
]

async def analyze_call(request: web.Request):
    data = await request.json()
    transcript_entries = data.get("transcriptEntries", [])

    transcript_text = ""
    for entry in transcript_entries:
        speaker = entry.get("speaker", "Unknown")
        timestamp = entry.get("timestamp", "")
        text = entry.get("text", "")
        transcript_text += f"{speaker} ({timestamp}): {text}\n"

    # Update the prompt to request the new key phrases
    user_prompt = f"""
    You are a call analytics assistant for a Sky UK call center.
    Given the conversation between a Customer and an Agent below, 
    analyze the call and produce the structured JSON result by calling the `analyze_call` function.

    In addition to the fields already described, also extract:
    - A list of key phrases that highlight problems or issues mentioned by the customer.
    - A list of key phrases that highlight resolutions or solutions provided by the agent.
    - A list of key phrases that might require further human review or investigation.

    Conversation:
    {transcript_text}
    """

    try:
        # Assuming `client` is already defined as in your original code
        response = client.chat.completions.create(
            model=os.environ["AZURE_OPENAI_GPT4O_DEPLOYMENT"],
            messages=[
                {"role": "system", "content": "You are an AI assistant."},
                {"role": "user", "content": user_prompt}
            ],
            functions=functions,
            function_call="auto",
            temperature=0.3
        )

        choice = response.choices[0]
        if choice.message.function_call:
            function_call = choice.message.function_call
            arguments = function_call.arguments
            try:
                analysis_json = json.loads(arguments)
            except json.JSONDecodeError as e:
                logger.error("JSON parsing failed for function call arguments. Raw: %s", arguments)
                return web.json_response({"error": "Failed to parse analysis JSON."}, status=500)
            return web.json_response({"analytics": analysis_json})
        else:
            logger.error("No function call returned by model.")
            return web.json_response({"error": "Model did not return structured data."}, status=500)

    except Exception as e:
        logger.error(f"Error calling OpenAI: {e}")
        return web.json_response({"error": "Error occurred while analyzing the call."}, status=500)

async def create_app():
    if not os.environ.get("RUNNING_IN_PRODUCTION"):
        logger.info("Running in development mode, loading from .env file")
        load_dotenv()

    llm_key = os.environ.get("AZURE_OPENAI_API_KEY")
    search_key = os.environ.get("AZURE_SEARCH_API_KEY")

    credential = None
    if not llm_key or not search_key:
        if tenant_id := os.environ.get("AZURE_TENANT_ID"):
            logger.info("Using AzureDeveloperCliCredential with tenant_id %s", tenant_id)
            credential = AzureDeveloperCliCredential(tenant_id=tenant_id, process_timeout=60)
        else:
            logger.info("Using DefaultAzureCredential")
            credential = DefaultAzureCredential()
    llm_credential = AzureKeyCredential(llm_key) if llm_key else credential
    search_credential = AzureKeyCredential(search_key) if search_key else credential
    
    app = web.Application()

    rtmt = RTMiddleTier(
        credentials=llm_credential,
        endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        deployment=os.environ["AZURE_OPENAI_REALTIME_DEPLOYMENT"],
        voice_choice=os.environ.get("AZURE_OPENAI_REALTIME_VOICE_CHOICE") or "alloy"
    )
    rtmt.system_message = (
        "You are a helpful assistant. Only answer questions based on information you searched in the knowledge base, "
        "accessible with the 'search' tool. The user is listening to answers with audio, so it's *super* important "
        "that answers are as short as possible, a single sentence if at all possible. Never read file names or source "
        "names or keys out loud. Always use the following step-by-step instructions to respond:\n"
        "1. Always use the 'search' tool to check the knowledge base before answering a question.\n"
        "2. Always use the 'report_grounding' tool to report the source of information from the knowledge base.\n"
        "3. Produce an answer that's as short as possible. If the answer isn't in the knowledge base, say you don't know."
    )
    attach_rag_tools(
        rtmt,
        credentials=search_credential,
        search_endpoint=os.environ.get("AZURE_SEARCH_ENDPOINT"),
        search_index=os.environ.get("AZURE_SEARCH_INDEX"),
        semantic_configuration=os.environ.get("AZURE_SEARCH_SEMANTIC_CONFIGURATION") or "default",
        identifier_field=os.environ.get("AZURE_SEARCH_IDENTIFIER_FIELD") or "chunk_id",
        content_field=os.environ.get("AZURE_SEARCH_CONTENT_FIELD") or "chunk",
        embedding_field=os.environ.get("AZURE_SEARCH_EMBEDDING_FIELD") or "text_vector",
        title_field=os.environ.get("AZURE_SEARCH_TITLE_FIELD") or "title",
        use_vector_query=(os.environ.get("AZURE_SEARCH_USE_VECTOR_QUERY") == "true") or True
    )

    rtmt.attach_to_app(app, "/realtime")

    # Add the new route for call analysis
    app.add_routes([web.post('/api/analyzeCall', analyze_call)])

    current_directory = Path(__file__).parent
    app.add_routes([web.get('/', lambda _: web.FileResponse(current_directory / 'static/index.html'))])
    app.router.add_static('/', path=current_directory / 'static', name='static')
    
    return app

if __name__ == "__main__":
    host = "localhost"
    port = 8765
    web.run_app(create_app(), host=host, port=port)
