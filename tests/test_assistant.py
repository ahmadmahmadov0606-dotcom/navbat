from types import SimpleNamespace as NS
from unittest import mock

import pytest

from myapp.models import Service

pytestmark = pytest.mark.django_db


def reply(stop, *blocks):
    return NS(stop_reason=stop, content=list(blocks))


@pytest.fixture(autouse=True)
def no_real_keys(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


def test_assistant_needs_key(client):
    r = client.post("/api/assistant/", {"messages": [{"role": "user", "content": "hi"}]}, format="json")
    assert r.status_code == 503 and r.json()["code"] == "assistant_unavailable"


def test_assistant_uses_tools_on_real_data(now, client, provider, monkeypatch):
    Service.objects.create(provider=provider, name_en="Teeth cleaning", name_ru="Чистка зубов", duration_min=60, price=100)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    calls = []

    def create(**kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            return reply("tool_use",
                         NS(type="tool_use", id="t1", name="search_providers", input={"search": "зуб"}),
                         NS(type="tool_use", id="t2", name="get_free_times", input={"provider_id": provider.id, "date": "2030-01-07"}))
        return reply("end_turn", NS(type="text", text="Doc has time at 09:00."))

    with mock.patch("myapp.assistant.anthropic.Anthropic") as cls:
        cls.return_value.beta.messages.create.side_effect = create
        r = client.post("/api/assistant/", {"messages": [{"role": "user", "content": "болит зуб"}]}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["reply"] == "Doc has time at 09:00."
    assert [p["id"] for p in r.json()["providers"]] == [provider.id]
    results = calls[1]["messages"][-1]["content"]
    assert "Teeth cleaning" in results[0]["content"] or "Чистка" in results[0]["content"]
    assert "09:00" in results[1]["content"]
    assert calls[0]["model"] == "claude-opus-5-5" and calls[0]["fallbacks"] == "default"


def test_assistant_validates_messages(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    assert client.post("/api/assistant/", {"messages": [{"role": "system", "content": "x"}]}, format="json").status_code == 400
    assert client.post("/api/assistant/", {"messages": []}, format="json").status_code == 400


def test_assistant_with_gemini(now, client, provider, monkeypatch):
    Service.objects.create(provider=provider, name_en="Teeth cleaning", duration_min=60, price=100)
    monkeypatch.setenv("GEMINI_API_KEY", "test")
    sent = []

    def generate(model, contents, config):
        sent.append(contents[:])
        if len(sent) == 1:
            call = NS(name="get_free_times", args={"provider_id": provider.id, "date": "2030-01-07"})
            return NS(function_calls=[call], candidates=[NS(content="model turn")], text=None)
        return NS(function_calls=None, text="Free at 09:00.")

    with mock.patch("myapp.assistant.genai.Client") as cls:
        cls.return_value.models.generate_content.side_effect = generate
        r = client.post("/api/assistant/", {"messages": [{"role": "user", "content": "free time?"}]}, format="json")
    assert r.status_code == 200, r.content
    assert r.json()["reply"] == "Free at 09:00." and r.json()["providers"][0]["id"] == provider.id
    result = sent[1][-1].parts[0].function_response.response["result"]
    assert "09:00" in result["times"]


def test_parse_reply():
    from myapp.assistant import parse_reply

    text, found = parse_reply('{"reply": "Салом", "specialty": "dentist", "city": "khujand", "date": null, "service": null}')
    assert text == "Салом" and found == {"specialty": "dentist", "city": "khujand", "date": None, "service": None}
    assert parse_reply('```json\n{"reply": "Hi", "city": null}\n```')[0] == "Hi"
    assert parse_reply("plain text") == ("plain text", {})


def test_prompt_has_rules_and_context(db):
    from myapp.assistant import system_prompt

    prompt = system_prompt()
    assert "call 103" in prompt and "Return ONLY valid JSON" in prompt and "{context}" not in prompt
    assert "search_providers" in prompt and "Today:" in prompt
