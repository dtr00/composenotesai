use super::chat::{
    json_body, read_lines, send, wire_tools, ChatEvent, ChatMessage, ChatRequest, Emitter, Generation, RemoteModel,
    Role, ToolSpec,
};
use super::stream::sse_data;
use crate::shared::cancel::CancelToken;
use crate::shared::error::{Error, Result};
use serde_json::{json, Value};

const DONE: &str = "[DONE]";

pub struct Target<'a> {
    pub base_url: &'a str,
    pub api_key: Option<&'a str>,
    pub llama: bool,
}

fn api_root(base_url: &str) -> String {
    let base = base_url.trim_end_matches('/');
    let path = base.splitn(4, '/').nth(3).unwrap_or_default();
    if path.is_empty() {
        format!("{base}/v1")
    } else {
        base.to_owned()
    }
}

fn authorized(request: reqwest::RequestBuilder, api_key: Option<&str>) -> reqwest::RequestBuilder {
    match api_key {
        Some(key) => request.bearer_auth(key),
        None => request,
    }
}

fn user_content(message: &ChatMessage) -> Value {
    if message.images.is_empty() {
        return json!(message.content);
    }
    let text = (!message.content.is_empty()).then(|| json!({ "type": "text", "text": message.content }));
    let images =
        message.images.iter().map(|image| json!({ "type": "image_url", "image_url": { "url": image.data_url() } }));
    Value::Array(text.into_iter().chain(images).collect())
}

fn wire_message(message: &ChatMessage) -> Value {
    match message.role {
        Role::System => json!({ "role": "system", "content": message.content }),
        Role::User => json!({ "role": "user", "content": user_content(message) }),
        Role::Tool => json!({
            "role": "tool",
            "tool_call_id": message.tool_call_id.clone().unwrap_or_default(),
            "content": message.content,
        }),
        Role::Assistant => {
            let mut wire = json!({ "role": "assistant", "content": message.content });
            if !message.tool_calls.is_empty() {
                let calls: Vec<Value> = message
                    .tool_calls
                    .iter()
                    .map(|call| {
                        json!({
                            "id": call.id,
                            "type": "function",
                            "function": { "name": call.name, "arguments": call.arguments },
                        })
                    })
                    .collect();
                wire["tool_calls"] = Value::Array(calls);
            }
            wire
        }
    }
}

fn body(target: &Target, request: &ChatRequest, tools: &[ToolSpec], generation: Generation) -> Value {
    let mut body = json!({
        "model": request.model,
        "messages": request.messages.iter().map(wire_message).collect::<Vec<_>>(),
        "stream": true,
        "stream_options": { "include_usage": true },
        "temperature": generation.temperature,
        "top_p": generation.top_p,
    });
    if let Some(max_tokens) = generation.max_tokens {
        body["max_tokens"] = json!(max_tokens);
    }
    if !tools.is_empty() {
        body["tools"] = Value::Array(wire_tools(tools));
    }
    if target.llama {
        body["chat_template_kwargs"] = json!({ "enable_thinking": generation.thinking });
    }
    body
}

#[derive(Default)]
struct Usage {
    finish_reason: Option<String>,
    prompt_tokens: Option<u64>,
    completion_tokens: Option<u64>,
    tokens_per_second: Option<f64>,
}

fn read_chunk(chunk: &Value, emitter: &mut Emitter, usage: &mut Usage) -> Result<()> {
    if let Some(error) = chunk.get("error") {
        let message = error.get("message").and_then(Value::as_str).or(error.as_str()).unwrap_or("The model failed.");
        return Err(Error::Message(message.to_owned()));
    }
    if let Some(choice) = chunk.get("choices").and_then(|choices| choices.get(0)) {
        let delta = choice.get("delta").unwrap_or(&Value::Null);
        for key in ["reasoning_content", "reasoning"] {
            if let Some(reasoning) = delta.get(key).and_then(Value::as_str) {
                emitter.reasoning(reasoning);
            }
        }
        if let Some(text) = delta.get("content").and_then(Value::as_str) {
            emitter.text(text);
        }
        for call in delta.get("tool_calls").and_then(Value::as_array).into_iter().flatten() {
            let function = call.get("function").unwrap_or(&Value::Null);
            let text = |value: Option<&Value>| value.and_then(Value::as_str).map(str::to_owned);
            emitter.event(ChatEvent::ToolCall {
                index: call.get("index").and_then(Value::as_u64).unwrap_or(0) as usize,
                id: text(call.get("id")).filter(|id| !id.is_empty()),
                name: text(function.get("name")).filter(|name| !name.is_empty()),
                arguments: text(function.get("arguments")).unwrap_or_default(),
            });
        }
        if let Some(reason) = choice.get("finish_reason").and_then(Value::as_str) {
            usage.finish_reason = Some(reason.to_owned());
        }
    }
    if let Some(counts) = chunk.get("usage").filter(|usage| usage.is_object()) {
        usage.prompt_tokens = counts.get("prompt_tokens").and_then(Value::as_u64);
        usage.completion_tokens = counts.get("completion_tokens").and_then(Value::as_u64);
    }
    if let Some(speed) = chunk.get("timings").and_then(|timings| timings.get("predicted_per_second")) {
        usage.tokens_per_second = speed.as_f64();
    }
    Ok(())
}

pub async fn stream(
    client: &reqwest::Client,
    target: &Target<'_>,
    request: &ChatRequest,
    tools: &[ToolSpec],
    generation: Generation,
    cancel: &CancelToken,
    emit: &(dyn Fn(ChatEvent) + Sync),
) -> Result<()> {
    let url = format!("{}/chat/completions", api_root(target.base_url));
    let http = json_body(authorized(client.post(&url), target.api_key), &body(target, request, tools, generation))?;
    let Some(response) = cancel.run(send(http)).await else {
        return Ok(());
    };
    let mut emitter = Emitter::new(emit);
    let mut usage = Usage::default();
    read_lines(response?, cancel, |line| {
        let Some(data) = sse_data(line) else {
            return Ok(true);
        };
        if data == DONE {
            return Ok(false);
        }
        let chunk: Value =
            serde_json::from_str(data).map_err(|_| Error::Message("The model sent an unreadable reply.".into()))?;
        read_chunk(&chunk, &mut emitter, &mut usage)?;
        Ok(true)
    })
    .await?;
    emitter.flush();
    if !cancel.is_cancelled() {
        emitter.event(ChatEvent::Done {
            finish_reason: usage.finish_reason,
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            tokens_per_second: usage.tokens_per_second,
        });
    }
    Ok(())
}

pub async fn models(client: &reqwest::Client, base_url: &str, api_key: Option<&str>) -> Result<Vec<RemoteModel>> {
    let url = format!("{}/models", api_root(base_url));
    let text = send(authorized(client.get(&url), api_key)).await?.text().await?;
    let listing: Value = serde_json::from_str(&text)
        .map_err(|_| Error::Message("This server didn't list its models. Check the address.".into()))?;
    let mut models: Vec<RemoteModel> = listing
        .get("data")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|entry| entry.get("id").and_then(Value::as_str))
        .map(|id| RemoteModel {
            id: id.to_owned(),
            name: id.to_owned(),
            size_bytes: None,
            details: None,
            vision: false,
        })
        .collect();
    models.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(models)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::ai::chat::{ChatImage, ToolCall};

    fn collect(chunks: &[&str]) -> (Vec<ChatEvent>, Usage) {
        let events = std::sync::Mutex::new(Vec::new());
        let emit = |event: ChatEvent| events.lock().unwrap().push(event);
        let mut emitter = Emitter::new(&emit);
        let mut usage = Usage::default();
        for chunk in chunks {
            read_chunk(&serde_json::from_str(chunk).unwrap(), &mut emitter, &mut usage).unwrap();
        }
        emitter.flush();
        drop(emitter);
        (events.into_inner().unwrap(), usage)
    }

    #[test]
    fn adds_v1_only_to_bare_hosts() {
        assert_eq!(api_root("http://localhost:1234"), "http://localhost:1234/v1");
        assert_eq!(api_root("http://localhost:1234/"), "http://localhost:1234/v1");
        assert_eq!(api_root("https://ai.example.com/llm/v1/"), "https://ai.example.com/llm/v1");
    }

    #[test]
    fn reads_text_reasoning_tool_calls_and_usage() {
        let (events, usage) = collect(&[
            r#"{"choices":[{"delta":{"reasoning_content":"hmm"}}]}"#,
            r#"{"choices":[{"delta":{"content":"Hi"}}]}"#,
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"read_note","arguments":"{\"no"}}]}}]}"#,
            r#"{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"teId\":2}"}}]}}]}"#,
            r#"{"choices":[{"finish_reason":"tool_calls","delta":{}}]}"#,
            r#"{"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":4},"timings":{"predicted_per_second":50.5}}"#,
        ]);
        assert_eq!(
            events,
            [
                ChatEvent::Reasoning { delta: "hmm".into() },
                ChatEvent::Text { delta: "Hi".into() },
                ChatEvent::ToolCall {
                    index: 0,
                    id: Some("c1".into()),
                    name: Some("read_note".into()),
                    arguments: "{\"no".into()
                },
                ChatEvent::ToolCall { index: 0, id: None, name: None, arguments: "teId\":2}".into() },
            ]
        );
        assert_eq!(usage.finish_reason.as_deref(), Some("tool_calls"));
        assert_eq!((usage.prompt_tokens, usage.completion_tokens), (Some(10), Some(4)));
        assert_eq!(usage.tokens_per_second, Some(50.5));
    }

    #[test]
    fn builds_requests_with_tools_and_llama_thinking() {
        let request = ChatRequest {
            provider: "local".into(),
            model: "m.gguf".into(),
            messages: vec![
                ChatMessage {
                    role: Role::Assistant,
                    content: String::new(),
                    images: Vec::new(),
                    tool_calls: vec![ToolCall { id: "c1".into(), name: "read_note".into(), arguments: "{}".into() }],
                    tool_call_id: None,
                    tool_name: None,
                },
                ChatMessage {
                    role: Role::Tool,
                    content: "body".into(),
                    images: Vec::new(),
                    tool_calls: Vec::new(),
                    tool_call_id: Some("c1".into()),
                    tool_name: Some("read_note".into()),
                },
            ],
            tools: vec![ToolSpec { name: "read_note".into(), description: "Read".into(), parameters: json!({}) }],
        };
        let generation =
            Generation { temperature: 0.5, top_p: 0.9, max_tokens: None, context_size: 4096, thinking: false };
        let target = Target { base_url: "http://127.0.0.1:1", api_key: None, llama: true };
        let wire = body(&target, &request, &request.tools, generation);
        assert_eq!(wire["messages"][0]["tool_calls"][0]["function"]["name"], "read_note");
        assert_eq!(wire["messages"][1]["tool_call_id"], "c1");
        assert_eq!(wire["tools"][0]["type"], "function");
        assert_eq!(wire["chat_template_kwargs"]["enable_thinking"], false);
        assert!(wire.get("max_tokens").is_none());
        let remote = Target { llama: false, ..target };
        assert!(body(&remote, &request, &[], generation).get("chat_template_kwargs").is_none());
    }

    #[test]
    fn user_images_become_content_parts_after_the_text() {
        let mut message = ChatMessage {
            role: Role::User,
            content: "What is drawn?".into(),
            images: vec![ChatImage { mime_type: "image/png".into(), data: "iVBO".into() }],
            tool_calls: Vec::new(),
            tool_call_id: None,
            tool_name: None,
        };
        assert_eq!(
            wire_message(&message),
            json!({ "role": "user", "content": [
                { "type": "text", "text": "What is drawn?" },
                { "type": "image_url", "image_url": { "url": "data:image/png;base64,iVBO" } },
            ] })
        );
        message.images.clear();
        assert_eq!(wire_message(&message), json!({ "role": "user", "content": "What is drawn?" }));
    }
}
