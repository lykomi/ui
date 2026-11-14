import asyncio
import json
import os
from contextvars import ContextVar
from typing import Annotated, Any
from urllib.parse import quote

import httpx
from agent_framework import tool
from azure.identity import DefaultAzureCredential
from pydantic import Field


QUERY_SOURCE_AUTHORIZATION: ContextVar[str | None] = ContextVar(
    "foundry_iq_query_source_authorization",
    default=None,
)

MCP_API_VERSION = "2026-05-01-preview"
RETRIEVE_API_VERSION = "2026-05-01-preview"
MCP_PROTOCOL_VERSION = "2024-11-05"

# Module-level singleton — DefaultAzureCredential is designed to be long-lived
# and manages its own token-refresh cache internally.
_AZURE_CREDENTIAL = DefaultAzureCredential()


def set_query_source_authorization(value: str | None):
    return QUERY_SOURCE_AUTHORIZATION.set(value)


def reset_query_source_authorization(token) -> None:
    QUERY_SOURCE_AUTHORIZATION.reset(token)


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if value:
        return value
    raise RuntimeError(f"{name} is not set. Configure agent/.env before using Foundry IQ.")


def _mcp_endpoint() -> str:
    search_endpoint = _search_endpoint()
    knowledge_base = quote(_knowledge_base_name(), safe="")
    api_version = os.getenv("FOUNDRY_IQ_MCP_API_VERSION", MCP_API_VERSION)
    return f"{search_endpoint}/knowledgebases/{knowledge_base}/mcp?api-version={api_version}"


def _retrieve_endpoint() -> str:
    search_endpoint = _search_endpoint()
    knowledge_base = quote(_knowledge_base_name(), safe="")
    api_version = os.getenv("FOUNDRY_IQ_RETRIEVE_API_VERSION", RETRIEVE_API_VERSION)
    return f"{search_endpoint}/knowledgebases/{knowledge_base}/retrieve?api-version={api_version}"


def _search_endpoint() -> str:
    return _required_env("AZURE_AI_SEARCH_ENDPOINT").rstrip("/")


def _knowledge_base_name() -> str:
    return _required_env("FOUNDRY_IQ_KNOWLEDGE_BASE")


def _query_source_authorization() -> str | None:
    return QUERY_SOURCE_AUTHORIZATION.get() or os.getenv("FOUNDRY_IQ_QUERY_SOURCE_AUTHORIZATION")


async def _post_mcp(
    client: httpx.AsyncClient,
    endpoint: str,
    access_token: str,
    payload: dict[str, Any],
) -> dict[str, Any] | None:
    headers = {
        "accept": "application/json, text/event-stream",
        "authorization": f"Bearer {access_token}",
        "content-type": "application/json",
    }
    query_source_authorization = _query_source_authorization()
    if query_source_authorization:
        headers["x-ms-query-source-authorization"] = query_source_authorization

    async with client.stream("POST", endpoint, headers=headers, json=payload) as response:
        response.raise_for_status()

        content_type = response.headers.get("content-type", "")
        if "text/event-stream" in content_type:
            latest: dict[str, Any] | None = None
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line.removeprefix("data:").strip()
                if data and data != "[DONE]":
                    latest = json.loads(data)
            return latest

        content = await response.aread()
        if not content:
            return None
        return json.loads(content)


async def _search_access_token() -> str:
    token = await asyncio.to_thread(
        _AZURE_CREDENTIAL.get_token,
        "https://search.azure.com/.default",
    )
    return token.token


async def _post_retrieve(
    client: httpx.AsyncClient,
    endpoint: str,
    access_token: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    headers = {
        "authorization": f"Bearer {access_token}",
        "content-type": "application/json",
    }
    query_source_authorization = _query_source_authorization()
    if query_source_authorization:
        headers["x-ms-query-source-authorization"] = query_source_authorization

    response = await client.post(endpoint, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()


def _parse_json_text(value: str) -> Any:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def _content_text(result: dict[str, Any]) -> str:
    content = result.get("result", {}).get("content")
    if not isinstance(content, list):
        return ""

    parts: list[str] = []
    for item in content:
        if isinstance(item, dict) and isinstance(item.get("text"), str):
            parts.append(item["text"])
        elif isinstance(item, str):
            parts.append(item)
    return "\n\n".join(parts)


def _extract_retrieve_results(retrieve_result: dict[str, Any] | None) -> list[Any]:
    if not retrieve_result:
        return []

    response = retrieve_result.get("response")
    if not isinstance(response, list):
        return []

    results: list[Any] = []
    for message in response:
        if not isinstance(message, dict):
            continue
        content = message.get("content")
        if not isinstance(content, list):
            continue
        for item in content:
            if not isinstance(item, dict) or not isinstance(item.get("text"), str):
                continue
            parsed = _parse_json_text(item["text"])
            if isinstance(parsed, list):
                results.extend(parsed)
            elif isinstance(parsed, dict):
                results.append(parsed)
    return results


def _content_to_tool_payload(
    result: dict[str, Any],
    *,
    query: str,
    tool_name: str,
    retrieve_result: dict[str, Any] | None = None,
    activity_error: str | None = None,
) -> str:
    if "error" in result:
        error = result["error"]
        if isinstance(error, dict):
            message = error.get("message") or json.dumps(error)
        else:
            message = str(error)
        return json.dumps(
            {
                "query": query,
                "tool": tool_name,
                "error": message,
                "raw": result,
                "activityError": activity_error,
                "retrieve": retrieve_result,
            },
            ensure_ascii=False,
        )

    text = _content_text(result)
    parsed = _parse_json_text(text) if text else result.get("result", result)
    payload = parsed
    if isinstance(parsed, dict) and "data" in parsed:
        payload = parsed["data"]

    results: list[Any] = []
    activity: list[Any] = []
    references: list[Any] = []
    response: list[Any] = []

    retrieve_results = _extract_retrieve_results(retrieve_result)

    if isinstance(payload, list):
        results = payload
    elif isinstance(payload, dict):
        if isinstance(payload.get("results"), list):
            results = payload["results"]
        elif isinstance(payload.get("value"), list):
            results = payload["value"]
        if isinstance(payload.get("activity"), list):
            activity = payload["activity"]
        if isinstance(payload.get("references"), list):
            references = payload["references"]
        if isinstance(payload.get("response"), list):
            response = payload["response"]

    if retrieve_results:
        results = retrieve_results

    if retrieve_result:
        if not activity and isinstance(retrieve_result.get("activity"), list):
            activity = retrieve_result["activity"]
        if not references and isinstance(retrieve_result.get("references"), list):
            references = retrieve_result["references"]
        if not response and isinstance(retrieve_result.get("response"), list):
            response = retrieve_result["response"]

    return json.dumps(
        {
            "query": query,
            "tool": tool_name,
            "results": results,
            "activity": activity,
            "references": references,
            "response": response,
            "activityError": activity_error,
            "content": parsed,
            "retrieve": retrieve_result,
            "raw": result.get("result", result),
        },
        ensure_ascii=False,
    )


async def _call_retrieve_activity(
    client: httpx.AsyncClient,
    query: str,
    access_token: str,
) -> dict[str, Any] | None:
    if os.getenv("FOUNDRY_IQ_INCLUDE_ACTIVITY", "true").lower() in {"0", "false", "no"}:
        return None

    payload: dict[str, Any] = {
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": query}],
            }
        ],
        "includeActivity": True,
    }

    max_output_documents = os.getenv("FOUNDRY_IQ_MAX_OUTPUT_DOCUMENTS")
    if max_output_documents and max_output_documents.isdigit():
        payload["maxOutputDocuments"] = int(max_output_documents)

    return await _post_retrieve(client, _retrieve_endpoint(), access_token, payload)


async def _call_knowledge_base(query: str) -> str:
    endpoint = _mcp_endpoint()
    tool_name = os.getenv("FOUNDRY_IQ_MCP_TOOL_NAME", "knowledge_base_retrieve")
    retrieve_result: dict[str, Any] | None = None
    activity_error: str | None = None

    try:
        token = await _search_access_token()
    except Exception as exc:
        return json.dumps(
            {
                "query": query,
                "tool": tool_name,
                "error": (
                    f"Unable to authenticate with Azure AI Search. "
                    f"Verify az login or managed-identity permissions. ({type(exc).__name__}: {exc})"
                ),
            },
            ensure_ascii=False,
        )

    result: dict[str, Any] | None = None
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            await _post_mcp(
                client,
                endpoint,
                token,
                {
                    "jsonrpc": "2.0",
                    "id": "initialize",
                    "method": "initialize",
                    "params": {
                        "protocolVersion": MCP_PROTOCOL_VERSION,
                        "capabilities": {},
                        "clientInfo": {"name": "lykomi-ui-starter", "version": "0.0.0"},
                    },
                },
            )
            await _post_mcp(
                client,
                endpoint,
                token,
                {"jsonrpc": "2.0", "method": "notifications/initialized"},
            )
            result = await _post_mcp(
                client,
                endpoint,
                token,
                {
                    "jsonrpc": "2.0",
                    "id": "retrieve",
                    "method": "tools/call",
                    "params": {
                        "name": tool_name,
                        "arguments": {"queries": [query]},
                    },
                },
            )
            try:
                retrieve_result = await _call_retrieve_activity(client, query, token)
            except httpx.HTTPError as exc:
                activity_error = f"{type(exc).__name__}: {exc}"
    except httpx.HTTPError as exc:
        return json.dumps(
            {
                "query": query,
                "tool": tool_name,
                "error": (
                    f"Failed to connect to the Foundry IQ knowledge base MCP endpoint. "
                    f"Verify AZURE_AI_SEARCH_ENDPOINT and FOUNDRY_IQ_KNOWLEDGE_BASE. "
                    f"({type(exc).__name__}: {exc})"
                ),
            },
            ensure_ascii=False,
        )

    if result is None:
        return "Foundry IQ returned no MCP content."
    return _content_to_tool_payload(
        result,
        query=query,
        tool_name=tool_name,
        retrieve_result=retrieve_result,
        activity_error=activity_error,
    )


@tool(approval_mode="never_require")
async def foundry_iq_search(
    query: Annotated[str, Field(description="Question to retrieve from the Foundry IQ knowledge base.")],
) -> str:
    """Retrieve relevant content from the configured Foundry IQ knowledge base."""
    return await _call_knowledge_base(query)


FOUNDRY_IQ_TOOLS = [foundry_iq_search]
