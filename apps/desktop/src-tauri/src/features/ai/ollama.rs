use super::chat::{
    json_body, read_lines, send, tool_arguments, wire_tools, ChatEvent, ChatMessage, ChatRequest, Emitter, Generation,
    RemoteModel, Role, ToolSpec,
};
use crate::shared::cancel::CancelToken;
use crate::shared::download::Progress;
use crate::shared::error::{Error, Result};
use serde_json::{json, Value};
use std::time::Duration;

const NANOS_PER_SECOND: f64 = 1e9;
const SHOW_TIMEOUT: Duration = Duration::from_secs(4);

fn wire_message(message: &ChatMessage) -> Value {
    match message.role {
        Role::System => json!({ "role": "system", "content": message.content }),
        Role::User if message.images.is_empty() => json!({ "role": "user", "content": message.content }),
        Role::User => {
            let images: Vec<&str> = message.images.iter().map(|image| image.data.as_str()).collect();
            json!({ "role": "user", "content": message.content, "images": images })
        }
        Role::Tool => json!({
            "role": "tool",
            "content": message.content,
            "tool_name": message.tool_name.clone().unwrap_or_default(),
        }),
        Role::Assistant => {
            let calls: Vec<Value> = message
                .tool_calls
                .iter()
                .map(|call| json!({ "function": { "name": call.name, "arguments": tool_arguments(&call.arguments) } }))
                .collect();
            if calls.is_empty() {
                json!({ "role": "assistant", "content": message.content })
            } else {
                json!({ "role": "assistant", "content": message.content, "tool_calls": calls })
            }
        }
    }
}

fn body(request: &ChatRequest, tools: &[ToolSpec], generation: Generation) -> Value {
    let mut options = json!({
        "temperature": generation.temperature,
        "top_p": generation.top_p,
        "num_ctx": generation.context_size,
    });
    if let Some(max_tokens) = generation.max_tokens {
        options["num_predict"] = json!(max_tokens);
    }
    let mut body = json!({
        "model": request.model,
        "messages": request.messages.iter().map(wire_message).collect::<Vec<_>>(),
        "stream": true,
        "options": options,
        "think": generation.thinking,
    });
    if !tools.is_empty() {
        body["tools"] = Value::Array(wire_tools(tools));
    }
    body
}

fn read_line(line: &Value, emitter: &mut Emitter, calls: &mut usize) -> Result<bool> {
    if let Some(error) = line.get("error").and_then(Value::as_str) {
        return Err(Error::Message(error.to_owned()));
    }
    let message = line.get("message").unwrap_or(&Value::Null);
    if let Some(thinking) = message.get("thinking").and_then(Value::as_str) {
        emitter.reasoning(thinking);
    }
    if let Some(text) = message.get("content").and_then(Value::as_str) {
        emitter.text(text);
    }
    for call in message.get("tool_calls").and_then(Value::as_array).into_iter().flatten() {
        let function = call.get("function").unwrap_or(&Value::Null);
        let arguments = match function.get("arguments") {
            Some(Value::String(text)) => text.clone(),
            Some(value) => value.to_string(),
            None => "{}".to_owned(),
        };
        emitter.event(ChatEvent::ToolCall {
            index: *calls,
            id: Some(format!("call_{calls}")),
            name: function.get("name").and_then(Value::as_str).map(str::to_owned),
            arguments,
        });
        *calls += 1;
    }
    if !line.get("done").and_then(Value::as_bool).unwrap_or(false) {
        return Ok(true);
    }
    emitter.flush();
    let count = |key: &str| line.get(key).and_then(Value::as_u64);
    let tokens_per_second = count("eval_count")
        .zip(count("eval_duration").filter(|&nanos| nanos > 0))
        .map(|(tokens, nanos)| tokens as f64 * NANOS_PER_SECOND / nanos as f64);
    let finish_reason = if *calls > 0 {
        Some("tool_calls".to_owned())
    } else {
        line.get("done_reason").and_then(Value::as_str).map(str::to_owned)
    };
    emitter.event(ChatEvent::Done {
        finish_reason,
        prompt_tokens: count("prompt_eval_count"),
        completion_tokens: count("eval_count"),
        tokens_per_second,
    });
    Ok(false)
}

fn parse(line: &str) -> Result<Value> {
    serde_json::from_str(line).map_err(|_| Error::Message("Ollama sent an unreadable reply.".into()))
}

pub async fn stream(
    client: &reqwest::Client,
    base_url: &str,
    request: &ChatRequest,
    tools: &[ToolSpec],
    generation: Generation,
    cancel: &CancelToken,
    emit: &(dyn Fn(ChatEvent) + Sync),
) -> Result<()> {
    let url = format!("{base_url}/api/chat");
    let http = json_body(client.post(&url), &body(request, tools, generation))?;
    let Some(response) = cancel.run(send(http)).await else {
        return Ok(());
    };
    let mut emitter = Emitter::new(emit);
    let mut calls = 0;
    read_lines(response?, cancel, |line| read_line(&parse(line)?, &mut emitter, &mut calls)).await
}

fn describe(entry: &Value) -> Option<String> {
    let details = entry.get("details")?;
    let parts: Vec<&str> = ["parameter_size", "quantization_level"]
        .iter()
        .filter_map(|key| details.get(key).and_then(Value::as_str).filter(|text| !text.is_empty()))
        .collect();
    (!parts.is_empty()).then(|| parts.join(" · "))
}

fn is_remote(info: &Value) -> bool {
    info.get("remote_host").is_some_and(|host| !host.is_null())
}

fn sees_images_locally(info: &Value) -> bool {
    let mut capabilities = info.get("capabilities").and_then(Value::as_array).into_iter().flatten();
    !is_remote(info) && capabilities.any(|capability| capability == "vision")
}

pub(super) async fn sees_images(client: &reqwest::Client, base_url: &str, model: &str) -> bool {
    let url = format!("{base_url}/api/show");
    let show = async {
        let response = send(json_body(client.post(&url), &json!({ "model": model })).ok()?).await.ok()?;
        serde_json::from_str::<Value>(&response.text().await.ok()?).ok()
    };
    let info = tokio::time::timeout(SHOW_TIMEOUT, show).await.ok().flatten();
    info.is_some_and(|info| sees_images_locally(&info))
}

pub async fn models(client: &reqwest::Client, base_url: &str) -> Result<Vec<RemoteModel>> {
    let url = format!("{base_url}/api/tags");
    let text = send(client.get(&url)).await?.text().await?;
    let listing: Value = serde_json::from_str(&text)
        .map_err(|_| Error::Message("This doesn't look like an Ollama server. Check the address.".into()))?;
    let entries: Vec<(&str, &Value)> = listing
        .get("models")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|entry| Some((entry.get("name").or_else(|| entry.get("model")).and_then(Value::as_str)?, entry)))
        .collect();
    let lookups: Vec<_> = entries
        .iter()
        .map(|(id, entry)| {
            let remote = is_remote(entry);
            let (client, base_url, model) = (client.clone(), base_url.to_owned(), id.to_string());
            tauri::async_runtime::spawn(async move { !remote && sees_images(&client, &base_url, &model).await })
        })
        .collect();
    let mut models = Vec::with_capacity(entries.len());
    for ((id, entry), lookup) in entries.into_iter().zip(lookups) {
        models.push(RemoteModel {
            id: id.to_owned(),
            name: id.strip_suffix(":latest").unwrap_or(id).to_owned(),
            size_bytes: entry.get("size").and_then(Value::as_u64),
            details: describe(entry),
            vision: lookup.await.unwrap_or(false),
        });
    }
    Ok(models)
}

pub async fn pull(
    client: &reqwest::Client,
    base_url: &str,
    model: &str,
    cancel: &CancelToken,
    on_progress: impl Fn(Progress),
) -> Result<bool> {
    let url = format!("{base_url}/api/pull");
    let http = json_body(client.post(&url), &json!({ "model": model, "stream": true }))?;
    let Some(response) = cancel.run(send(http)).await else {
        return Ok(false);
    };
    let mut finished = false;
    read_lines(response?, cancel, |line| {
        let update = parse(line)?;
        if let Some(error) = update.get("error").and_then(Value::as_str) {
            return Err(Error::Message(error.to_owned()));
        }
        if let (Some(total), Some(downloaded)) =
            (update.get("total").and_then(Value::as_u64), update.get("completed").and_then(Value::as_u64))
        {
            on_progress(Progress { downloaded, total });
        }
        finished = update.get("status").and_then(Value::as_str) == Some("success");
        Ok(!finished)
    })
    .await?;
    Ok(finished && !cancel.is_cancelled())
}

pub async fn delete(client: &reqwest::Client, base_url: &str, model: &str) -> Result<()> {
    let url = format!("{base_url}/api/delete");
    send(json_body(client.delete(&url), &json!({ "model": model }))?).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::ai::chat::{ChatImage, ToolCall};

    fn read(lines: &[&str]) -> Vec<ChatEvent> {
        let events = std::sync::Mutex::new(Vec::new());
        let emit = |event: ChatEvent| events.lock().unwrap().push(event);
        let mut emitter = Emitter::new(&emit);
        let mut calls = 0;
        for line in lines {
            read_line(&parse(line).unwrap(), &mut emitter, &mut calls).unwrap();
        }
        drop(emitter);
        events.into_inner().unwrap()
    }

    #[test]
    fn reads_thinking_text_tool_calls_and_the_summary() {
        let events = read(&[
            r#"{"message":{"role":"assistant","content":"","thinking":"plan"},"done":false}"#,
            r#"{"message":{"role":"assistant","content":"On it"},"done":false}"#,
            r#"{"message":{"role":"assistant","content":"","tool_calls":[{"function":{"name":"search_notes","arguments":{"query":"milk"}}}]},"done":false}"#,
            r#"{"message":{"role":"assistant","content":""},"done":true,"done_reason":"stop","prompt_eval_count":12,"eval_count":20,"eval_duration":1000000000}"#,
        ]);
        assert_eq!(events[0], ChatEvent::Reasoning { delta: "plan".into() });
        assert_eq!(events[1], ChatEvent::Text { delta: "On it".into() });
        assert_eq!(
            events[2],
            ChatEvent::ToolCall {
                index: 0,
                id: Some("call_0".into()),
                name: Some("search_notes".into()),
                arguments: r#"{"query":"milk"}"#.into()
            }
        );
        assert_eq!(
            events[3],
            ChatEvent::Done {
                finish_reason: Some("tool_calls".into()),
                prompt_tokens: Some(12),
                completion_tokens: Some(20),
                tokens_per_second: Some(20.0)
            }
        );
    }

    #[test]
    fn only_local_models_that_report_vision_can_see_images() {
        assert!(sees_images_locally(&json!({ "capabilities": ["completion", "vision"] })));
        assert!(!sees_images_locally(&json!({ "capabilities": ["completion", "tools"] })));
        assert!(!sees_images_locally(&json!({})));
        assert!(!sees_images_locally(&json!({ "capabilities": ["vision"], "remote_host": "https://ollama.com:443" })));
        assert!(sees_images_locally(&json!({ "capabilities": ["vision"], "remote_host": null })));
    }

    fn answer_show(body: &'static str) -> String {
        let listener = std::net::TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        std::thread::spawn(move || {
            use std::io::{Read, Write};
            let (mut stream, _) = listener.accept().unwrap();
            let _ = stream.read(&mut [0; 4096]);
            let reply = format!("HTTP/1.1 200 OK\r\ncontent-length: {}\r\n\r\n{body}", body.len());
            stream.write_all(reply.as_bytes()).unwrap();
        });
        address
    }

    #[test]
    fn images_are_checked_against_what_ollama_reports_for_the_model() {
        crate::shared::testing::install_tls();
        let client = reqwest::Client::new();
        let sees = |body| tauri::async_runtime::block_on(sees_images(&client, &answer_show(body), "llava"));
        assert!(sees(r#"{"capabilities":["completion","vision"]}"#));
        assert!(!sees(r#"{"capabilities":["vision"],"remote_host":"https://ollama.com:443"}"#));
        assert!(!sees(r#"{"capabilities":["completion"]}"#));
        assert!(!tauri::async_runtime::block_on(sees_images(&client, "http://127.0.0.1:9", "llava")));
    }

    #[test]
    fn user_images_are_sent_as_base64_next_to_the_text() {
        let message = ChatMessage {
            role: Role::User,
            content: "What is drawn?".into(),
            images: vec![ChatImage { mime_type: "image/png".into(), data: "iVBO".into() }],
            tool_calls: Vec::new(),
            tool_call_id: None,
            tool_name: None,
        };
        assert_eq!(wire_message(&message), json!({ "role": "user", "content": "What is drawn?", "images": ["iVBO"] }));
    }

    #[test]
    fn errors_in_the_stream_fail_the_request() {
        let events = std::sync::Mutex::new(Vec::new());
        let emit = |event: ChatEvent| events.lock().unwrap().push(event);
        let mut emitter = Emitter::new(&emit);
        let result = read_line(&json!({"error":"model 'x' not found"}), &mut emitter, &mut 0);
        assert!(matches!(result, Err(Error::Message(message)) if message.contains("not found")));
    }

    #[test]
    fn sends_tool_results_by_name_and_arguments_as_objects() {
        let request = ChatRequest {
            provider: "home".into(),
            model: "qwen3".into(),
            messages: vec![
                ChatMessage {
                    role: Role::Assistant,
                    content: String::new(),
                    images: Vec::new(),
                    tool_calls: vec![ToolCall {
                        id: "1".into(),
                        name: "read_note".into(),
                        arguments: r#"{"noteId":4}"#.into(),
                    }],
                    tool_call_id: None,
                    tool_name: None,
                },
                ChatMessage {
                    role: Role::Tool,
                    content: "text".into(),
                    images: Vec::new(),
                    tool_calls: Vec::new(),
                    tool_call_id: Some("1".into()),
                    tool_name: Some("read_note".into()),
                },
            ],
            tools: Vec::new(),
        };
        let generation =
            Generation { temperature: 0.7, top_p: 1.0, max_tokens: Some(64), context_size: 8192, thinking: false };
        let wire = body(&request, &[], generation);
        assert_eq!(wire["messages"][0]["tool_calls"][0]["function"]["arguments"]["noteId"], 4);
        assert_eq!(wire["messages"][1]["tool_name"], "read_note");
        assert_eq!(wire["options"]["num_ctx"], 8192);
        assert_eq!(wire["options"]["num_predict"], 64);
        assert_eq!(wire["think"], false);
        assert!(wire.get("tools").is_none());
    }
}
