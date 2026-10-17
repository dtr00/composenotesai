use super::stream::{LineReader, Piece, ThinkSplitter};
use super::{ollama, openai};
use crate::entities::ai::{AiSettings, ProviderConfig, ProviderKind};
use crate::shared::cancel::CancelToken;
use crate::shared::error::{Error, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

const LIST_TIMEOUT: Duration = Duration::from_secs(8);
const MAX_IMAGES: usize = 4;
const MAX_IMAGE_CHARS: usize = 4 << 20;
const IMAGE_TYPES: &[&str] = &["image/png", "image/jpeg"];
pub(super) const MAX_ERROR_CHARS: usize = 300;
const NO_TOOLS: &[&str] = &[
    "does not support tool",
    "tools param requires --jinja",
    "tool choice requires --enable-auto-tool-choice",
    "'tools' is not supported",
    "does not support function calling",
];
const NO_THINKING: &[&str] = &["does not support thinking"];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Capability {
    Tools,
    Thinking,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Role {
    System,
    User,
    Assistant,
    Tool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

#[derive(Clone, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatImage {
    pub mime_type: String,
    pub data: String,
}

impl ChatImage {
    pub fn data_url(&self) -> String {
        format!("data:{};base64,{}", self.mime_type, self.data)
    }

    fn is_valid(&self) -> bool {
        IMAGE_TYPES.contains(&self.mime_type.as_str())
            && !self.data.is_empty()
            && self.data.len() <= MAX_IMAGE_CHARS
            && self.data.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'/' | b'='))
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: Role,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub images: Vec<ChatImage>,
    #[serde(default)]
    pub tool_calls: Vec<ToolCall>,
    #[serde(default)]
    pub tool_call_id: Option<String>,
    #[serde(default)]
    pub tool_name: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ToolSpec {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub provider: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub tools: Vec<ToolSpec>,
}

impl ChatRequest {
    pub fn has_images(&self) -> bool {
        self.messages.iter().any(|message| !message.images.is_empty())
    }

    pub fn check_images(&self) -> Result<()> {
        let images = self.messages.iter().map(|message| message.images.len()).sum::<usize>();
        let misplaced = self.messages.iter().any(|message| message.role != Role::User && !message.images.is_empty());
        let invalid = self.messages.iter().flat_map(|message| &message.images).any(|image| !image.is_valid());
        if images > MAX_IMAGES || misplaced || invalid {
            return Err(Error::Message("An image couldn't be sent to the model. Try again.".into()));
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Generation {
    pub temperature: f64,
    pub top_p: f64,
    pub max_tokens: Option<u32>,
    pub context_size: u32,
    pub thinking: bool,
}

impl From<&AiSettings> for Generation {
    fn from(ai: &AiSettings) -> Self {
        Self {
            temperature: ai.temperature,
            top_p: ai.top_p,
            max_tokens: (ai.max_tokens > 0).then_some(ai.max_tokens),
            context_size: ai.context_size,
            thinking: ai.thinking,
        }
    }
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum ChatEvent {
    Status { message: String },
    Text { delta: String },
    Reasoning { delta: String },
    ToolCall { index: usize, id: Option<String>, name: Option<String>, arguments: String },
    Done {
        finish_reason: Option<String>,
        prompt_tokens: Option<u64>,
        completion_tokens: Option<u64>,
        tokens_per_second: Option<f64>,
    },
}

#[derive(Clone, Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteModel {
    pub id: String,
    pub name: String,
    pub size_bytes: Option<u64>,
    pub details: Option<String>,
    pub vision: bool,
}

#[derive(Clone, Debug)]
pub enum Endpoint {
    OpenAi { base_url: String, api_key: Option<String> },
    Llama { base_url: String, api_key: String },
    Ollama { base_url: String },
}

impl From<&ProviderConfig> for Endpoint {
    fn from(provider: &ProviderConfig) -> Self {
        let base_url = provider.base_url.clone();
        match provider.kind {
            ProviderKind::Ollama => Endpoint::Ollama { base_url },
            ProviderKind::OpenAi => Endpoint::OpenAi { base_url, api_key: provider.api_key.clone() },
        }
    }
}

impl Endpoint {
    fn base_url(&self) -> &str {
        let (Endpoint::OpenAi { base_url, .. } | Endpoint::Llama { base_url, .. } | Endpoint::Ollama { base_url }) =
            self;
        base_url
    }

    fn openai_target(&self) -> Option<openai::Target<'_>> {
        match self {
            Endpoint::OpenAi { base_url, api_key } => {
                Some(openai::Target { base_url, api_key: api_key.as_deref(), llama: false })
            }
            Endpoint::Llama { base_url, api_key } => {
                Some(openai::Target { base_url, api_key: Some(api_key), llama: true })
            }
            Endpoint::Ollama { .. } => None,
        }
    }
}

pub(super) fn api_message(body: &str) -> String {
    let parsed: Option<Value> = serde_json::from_str(body).ok();
    let message = parsed.as_ref().and_then(|json| {
        let error = json.get("error")?;
        error.as_str().or_else(|| error.get("message").and_then(Value::as_str)).map(str::to_owned)
    });
    message.unwrap_or_else(|| body.trim().chars().take(MAX_ERROR_CHARS).collect())
}

fn missing_capability(error: &Error) -> Option<Capability> {
    let Error::Message(message) = error else { return None };
    let message = message.to_lowercase();
    let says = |phrases: &[&str]| phrases.iter().any(|phrase| message.contains(phrase));
    if says(NO_TOOLS) {
        Some(Capability::Tools)
    } else if says(NO_THINKING) {
        Some(Capability::Thinking)
    } else {
        None
    }
}

pub(super) async fn send(request: reqwest::RequestBuilder) -> Result<reqwest::Response> {
    let response = request.send().await?;
    let status = response.status();
    if status.is_success() {
        return Ok(response);
    }
    let message = api_message(&response.text().await.unwrap_or_default());
    Err(Error::Message(if message.is_empty() { format!("The server answered {status}.") } else { message }))
}

pub(super) fn wire_tools(tools: &[ToolSpec]) -> Vec<Value> {
    tools
        .iter()
        .map(|tool| {
            json!({
                "type": "function",
                "function": { "name": tool.name, "description": tool.description, "parameters": tool.parameters },
            })
        })
        .collect()
}

pub(super) fn tool_arguments(arguments: &str) -> Value {
    serde_json::from_str::<Value>(arguments).ok().filter(Value::is_object).unwrap_or_else(|| Value::Object(Map::new()))
}

pub(super) fn json_body(request: reqwest::RequestBuilder, body: &Value) -> Result<reqwest::RequestBuilder> {
    Ok(request.header(reqwest::header::CONTENT_TYPE, "application/json").body(serde_json::to_vec(body)?))
}

pub(super) struct Emitter<'a> {
    emit: &'a (dyn Fn(ChatEvent) + Sync),
    splitter: ThinkSplitter,
}

impl<'a> Emitter<'a> {
    pub(super) fn new(emit: &'a (dyn Fn(ChatEvent) + Sync)) -> Self {
        Self { emit, splitter: ThinkSplitter::default() }
    }

    pub(super) fn text(&mut self, delta: &str) {
        for piece in self.splitter.push(delta) {
            self.piece(piece);
        }
    }

    pub(super) fn reasoning(&self, delta: &str) {
        if !delta.is_empty() {
            (self.emit)(ChatEvent::Reasoning { delta: delta.to_owned() });
        }
    }

    pub(super) fn event(&self, event: ChatEvent) {
        (self.emit)(event);
    }

    fn piece(&self, piece: Piece) {
        match piece {
            Piece::Text(delta) => (self.emit)(ChatEvent::Text { delta }),
            Piece::Reasoning(delta) => self.reasoning(&delta),
        }
    }

    pub(super) fn flush(&mut self) {
        if let Some(piece) = self.splitter.finish() {
            self.piece(piece);
        }
    }
}

pub(super) async fn read_lines(
    mut response: reqwest::Response,
    cancel: &CancelToken,
    mut on_line: impl FnMut(&str) -> Result<bool>,
) -> Result<()> {
    let mut reader = LineReader::default();
    loop {
        let Some(chunk) = cancel.run(response.chunk()).await else {
            return Ok(());
        };
        let Some(chunk) = chunk? else {
            break;
        };
        for line in reader.push(&chunk) {
            if !on_line(&line)? {
                return Ok(());
            }
        }
    }
    if let Some(line) = reader.finish() {
        on_line(&line)?;
    }
    Ok(())
}

pub async fn stream_chat(
    client: &reqwest::Client,
    endpoint: &Endpoint,
    request: &ChatRequest,
    generation: Generation,
    cancel: &CancelToken,
    emit: &(dyn Fn(ChatEvent) + Sync),
) -> Result<()> {
    let emitted = AtomicBool::new(false);
    let tracked = |event: ChatEvent| {
        emitted.store(true, Ordering::Relaxed);
        emit(event);
    };
    let tracked: &(dyn Fn(ChatEvent) + Sync) = &tracked;
    let attempt = |tools: bool, thinking: bool| async move {
        let tools = if tools { request.tools.as_slice() } else { &[] };
        let generation = Generation { thinking, ..generation };
        match endpoint.openai_target() {
            Some(target) => openai::stream(client, &target, request, tools, generation, cancel, tracked).await,
            None => ollama::stream(client, endpoint.base_url(), request, tools, generation, cancel, tracked).await,
        }
    };
    let mut tools = !request.tools.is_empty();
    let mut thinking = generation.thinking;
    loop {
        let outcome = attempt(tools, thinking).await;
        let missing = outcome.as_ref().err().filter(|_| !emitted.load(Ordering::Relaxed)).and_then(missing_capability);
        match missing {
            Some(Capability::Tools) if tools => {
                tools = false;
                emit(ChatEvent::Status { message: "This model can't use tools, so it can only chat.".into() });
            }
            Some(Capability::Thinking) if thinking => thinking = false,
            _ => return outcome,
        }
    }
}

pub async fn list_models(client: &reqwest::Client, endpoint: &Endpoint) -> Result<Vec<RemoteModel>> {
    let listing = async {
        match endpoint.openai_target() {
            Some(target) => openai::models(client, target.base_url, target.api_key).await,
            None => ollama::models(client, endpoint.base_url()).await,
        }
    };
    tokio::time::timeout(LIST_TIMEOUT, listing)
        .await
        .map_err(|_| Error::Message("The server took too long to list its models.".into()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_api_error_messages() {
        assert_eq!(api_message(r#"{"error":{"message":"bad model"}}"#), "bad model");
        assert_eq!(api_message(r#"{"error":"model not found"}"#), "model not found");
        assert_eq!(api_message("Internal error\n"), "Internal error");
    }

    fn capability(message: &str) -> Option<Capability> {
        missing_capability(&Error::Message(message.into()))
    }

    #[test]
    fn recognizes_servers_that_cannot_use_tools() {
        for message in [
            "registry.ollama.ai/library/gemma:2b does not support tools",
            "tools param requires --jinja flag",
            "\"auto\" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set",
            "Unsupported parameter: 'tools' is not supported with this model.",
            "This model does not support function calling.",
        ] {
            assert_eq!(capability(message), Some(Capability::Tools), "{message}");
        }
    }

    #[test]
    fn recognizes_servers_that_cannot_think() {
        assert_eq!(capability("\"gemma3\" does not support thinking"), Some(Capability::Thinking));
    }

    #[test]
    fn other_tool_and_thinking_errors_keep_tools_and_thinking() {
        for message in [
            "model 'x' not found",
            "Invalid 'messages[3].tool_call_id': no tool call found",
            "failed to parse tool call arguments as JSON",
            "unknown tool: read_note",
            "thinking budget exceeded",
        ] {
            assert_eq!(capability(message), None, "{message}");
        }
        assert_eq!(missing_capability(&Error::NotFound("Chat", 1)), None);
    }

    #[test]
    fn parses_tool_arguments_leniently() {
        assert_eq!(tool_arguments(r#"{"a":1}"#), json!({"a":1}));
        assert_eq!(tool_arguments("not json"), json!({}));
        assert_eq!(tool_arguments("[1]"), json!({}));
    }

    #[test]
    fn chat_messages_accept_the_frontend_shape() {
        let message: ChatMessage = serde_json::from_str(
            r#"{"role":"assistant","content":"","toolCalls":[{"id":"1","name":"read_note","arguments":"{\"noteId\":3}"}]}"#,
        )
        .unwrap();
        assert_eq!(message.role, Role::Assistant);
        assert_eq!(message.tool_calls[0].name, "read_note");
    }

    fn message(role: Role, images: Vec<ChatImage>) -> ChatMessage {
        let content = "Look".into();
        ChatMessage { role, content, images, tool_calls: Vec::new(), tool_call_id: None, tool_name: None }
    }

    fn request(messages: Vec<ChatMessage>) -> ChatRequest {
        ChatRequest { provider: "local".into(), model: "m".into(), messages, tools: Vec::new() }
    }

    fn png(data: &str) -> ChatImage {
        ChatImage { mime_type: "image/png".into(), data: data.into() }
    }

    #[test]
    fn text_only_messages_from_saved_chats_have_no_images() {
        let message: ChatMessage = serde_json::from_str(r#"{"role":"user","content":"hi"}"#).unwrap();
        assert!(message.images.is_empty());
        let message: ChatMessage =
            serde_json::from_str(r#"{"role":"user","content":"","images":[{"mimeType":"image/png","data":"iVBO"}]}"#)
                .unwrap();
        assert_eq!(message.images, [png("iVBO")]);
        assert_eq!(message.images[0].data_url(), "data:image/png;base64,iVBO");
    }

    #[test]
    fn only_a_few_well_formed_user_images_are_sent() {
        assert!(request(vec![message(Role::User, vec![png("iVBO")])]).check_images().is_ok());
        assert!(request(vec![message(Role::User, Vec::new())]).check_images().is_ok());
        assert!(request(vec![message(Role::User, vec![png("iVBO"); MAX_IMAGES + 1])]).check_images().is_err());
        assert!(request(vec![message(Role::Tool, vec![png("iVBO")])]).check_images().is_err());
        assert!(request(vec![message(Role::User, vec![png("not base64!")])]).check_images().is_err());
        assert!(request(vec![message(Role::User, vec![png("")])]).check_images().is_err());
        let gif = ChatImage { mime_type: "image/gif".into(), data: "R0lG".into() };
        assert!(request(vec![message(Role::User, vec![gif])]).check_images().is_err());
    }

    #[test]
    fn events_serialize_with_a_type_tag() {
        let event = ChatEvent::ToolCall { index: 0, id: Some("a".into()), name: None, arguments: "{".into() };
        assert_eq!(
            serde_json::to_value(event).unwrap(),
            serde_json::json!({"type":"toolCall","index":0,"id":"a","name":null,"arguments":"{"})
        );
    }

    fn real_chat(name: &str, projector: Option<&std::path::Path>, request: &ChatRequest) -> Option<Vec<ChatEvent>> {
        use super::super::engine::{Engine, ServerOptions, Weights};
        let (Ok(server_dir), Ok(model)) = (std::env::var("CN_LLAMA_SERVER_DIR"), std::env::var("CN_LLAMA_MODEL"))
        else {
            return None;
        };
        crate::shared::testing::install_tls();
        let dir = crate::shared::testing::temp_dir(&format!("chat-{name}"));
        let build = dir.join(super::super::catalog::ENGINE_BUILD);
        std::fs::create_dir_all(&build).unwrap();
        for entry in std::fs::read_dir(&server_dir).unwrap().flatten() {
            #[cfg(unix)]
            std::os::unix::fs::symlink(entry.path(), build.join(entry.file_name())).unwrap();
        }
        let client = crate::shared::web::client().unwrap();
        let engine = Engine::new(dir.clone(), client.clone());
        let options = ServerOptions { context_size: 8192, use_gpu: true, threads: 0 };
        let generation =
            Generation { temperature: 0.2, top_p: 0.95, max_tokens: Some(256), context_size: 8192, thinking: false };
        let events = std::sync::Mutex::new(Vec::new());
        let emit = |event: ChatEvent| events.lock().unwrap().push(event);
        tauri::async_runtime::block_on(async {
            let weights = Weights { model: std::path::Path::new(&model), projector };
            let connection = engine.ensure(weights, options, || {}).await.unwrap();
            let endpoint = Endpoint::Llama { base_url: connection.base_url, api_key: connection.api_key };
            stream_chat(&client, &endpoint, request, generation, &CancelToken::default(), &emit).await.unwrap();
        });
        engine.stop();
        std::fs::remove_dir_all(&dir).unwrap();
        Some(events.into_inner().unwrap())
    }

    #[test]
    #[ignore = "needs a llama-server and model; set CN_LLAMA_SERVER_DIR and CN_LLAMA_MODEL"]
    fn streams_text_and_tool_calls_from_a_real_model() {
        let mut request = ChatRequest {
            provider: "local".into(),
            model: "test".into(),
            messages: vec![message(Role::User, Vec::new())],
            tools: vec![ToolSpec {
                name: "create_note".into(),
                description: "Create a new note".into(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": { "title": { "type": "string" }, "content": { "type": "string" } },
                    "required": ["title", "content"],
                }),
            }],
        };
        request.messages[0].content = "Create a note titled Groceries that lists eggs and milk.".into();
        let Some(events) = real_chat("tools", None, &request) else {
            return;
        };
        let arguments: String = events
            .iter()
            .filter_map(|event| match event {
                ChatEvent::ToolCall { arguments, .. } => Some(arguments.as_str()),
                _ => None,
            })
            .collect();
        let call: Value = serde_json::from_str(&arguments).unwrap();
        assert!(call["title"].as_str().unwrap().contains("Groceries"));
        assert!(
            matches!(events.last(), Some(ChatEvent::Done { finish_reason: Some(reason), .. }) if reason == "tool_calls")
        );
    }

    #[test]
    #[ignore = "needs a vision model; also set CN_LLAMA_MMPROJ, CN_TEST_IMAGE_BASE64 and CN_TEST_IMAGE_WORD"]
    fn a_real_vision_model_reads_text_in_an_image() {
        let variable = std::env::var;
        let (Ok(projector), Ok(image), Ok(word)) =
            (variable("CN_LLAMA_MMPROJ"), variable("CN_TEST_IMAGE_BASE64"), variable("CN_TEST_IMAGE_WORD"))
        else {
            return;
        };
        let data = std::fs::read_to_string(image).unwrap().trim().to_owned();
        let mut asked = message(Role::User, vec![ChatImage { mime_type: "image/png".into(), data }]);
        asked.content = "Read all the text in this image. Answer with the text only.".into();
        let request =
            ChatRequest { provider: "local".into(), model: "test".into(), messages: vec![asked], tools: Vec::new() };
        request.check_images().unwrap();
        let Some(events) = real_chat("vision", Some(std::path::Path::new(&projector)), &request) else {
            return;
        };
        let reply: String = events
            .iter()
            .filter_map(|event| match event {
                ChatEvent::Text { delta } => Some(delta.as_str()),
                _ => None,
            })
            .collect();
        assert!(reply.to_lowercase().contains(&word.to_lowercase()), "{reply}");
    }
}
