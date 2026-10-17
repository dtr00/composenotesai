use super::catalog::{engine_asset, ENGINE_BUILD};
use super::chat::MAX_ERROR_CHARS;
use crate::entities::catalog::{busy_message, CatalogFiles};
use crate::shared::disk::folder_bytes;
use crate::shared::download::Progress;
use crate::shared::error::{Error, Result};
use crate::shared::lock::Lock;
use crate::shared::secret::secret;
use serde::Serialize;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

const SERVER_NAME: &str = if cfg!(windows) { "llama-server.exe" } else { "llama-server" };
const LOG_FILE: &str = "server.log";
const STAGING_SUFFIX: &str = ".staging";
const MAX_SEARCH_DEPTH: usize = 3;
const HEALTH_POLL: Duration = Duration::from_millis(250);
const START_TIMEOUT: Duration = Duration::from_secs(600);
const LOG_TAIL_BYTES: u64 = 16 * 1024;
const ALL_GPU_LAYERS: &str = "999";
const START_ATTEMPTS: usize = 3;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ServerOptions {
    pub context_size: u32,
    pub use_gpu: bool,
    pub threads: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Weights<'a> {
    pub model: &'a Path,
    pub projector: Option<&'a Path>,
}

#[derive(Clone, Debug)]
pub struct Connection {
    pub base_url: String,
    pub api_key: String,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EngineInfo {
    pub available: bool,
    pub installed: bool,
    pub installing: bool,
    pub build: &'static str,
    pub download_bytes: u64,
    pub installed_bytes: u64,
    pub loaded_model: Option<String>,
}

struct Server {
    child: Child,
    port: u16,
    model: PathBuf,
    projector: Option<PathBuf>,
    options: ServerOptions,
    connection: Connection,
    ready: bool,
}

impl Server {
    fn runs(&self, weights: Weights) -> bool {
        self.model == weights.model && self.projector.as_deref() == weights.projector
    }

    fn uses(&self, file: &Path) -> bool {
        self.model == file || self.projector.as_deref() == Some(file)
    }

    fn is_running(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    fn stop(mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub struct Engine {
    client: reqwest::Client,
    files: CatalogFiles,
    starting: tokio::sync::Mutex<()>,
    server: Lock<Option<Server>>,
    in_use: AtomicUsize,
    last_used: Lock<Instant>,
}

enum Startup {
    Ready,
    PortTaken,
}

pub struct InUse<'a> {
    engine: &'a Engine,
}

impl Drop for InUse<'_> {
    fn drop(&mut self) {
        *self.engine.last_used.lock() = Instant::now();
        self.engine.in_use.fetch_sub(1, Ordering::Relaxed);
    }
}

fn find_server(dir: &Path, depth: usize) -> Option<PathBuf> {
    let candidate = dir.join(SERVER_NAME);
    if candidate.is_file() {
        return Some(candidate);
    }
    if depth == 0 {
        return None;
    }
    let mut folders: Vec<PathBuf> =
        fs::read_dir(dir).ok()?.flatten().map(|entry| entry.path()).filter(|path| path.is_dir()).collect();
    folders.sort();
    folders.iter().find_map(|folder| find_server(folder, depth - 1))
}

fn is_library(name: &str) -> bool {
    name.contains(".so") || name.ends_with(".dll") || name.ends_with(".dylib") || name.ends_with(".metal")
}

fn is_kept(name: &str) -> bool {
    let other_tool_library = name.contains("-impl.") && !name.contains("server-impl");
    name == SERVER_NAME || name.starts_with("LICENSE") || (is_library(name) && !other_tool_library)
}

fn prune(server_dir: &Path) -> Result<()> {
    for entry in fs::read_dir(server_dir)?.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let kind = entry.file_type()?;
        if !kind.is_dir() && !is_kept(&name) {
            fs::remove_file(entry.path())?;
        }
    }
    Ok(())
}

fn tar_program() -> PathBuf {
    if cfg!(windows) {
        let root = std::env::var_os("SystemRoot").map_or_else(|| PathBuf::from(r"C:\Windows"), PathBuf::from);
        root.join("System32").join("tar.exe")
    } else {
        PathBuf::from("tar")
    }
}

fn extract(archive: &Path, into: &Path) -> Result<()> {
    fs::create_dir_all(into)?;
    let mut command = Command::new(tar_program());
    command.arg("-xf").arg(archive).arg("-C").arg(into).stdin(Stdio::null()).stdout(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let output = command.stderr(Stdio::piped()).output()?;
    if output.status.success() {
        return Ok(());
    }
    let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    Err(Error::Message(format!("Couldn't unpack the AI engine. {detail}")))
}

fn free_port() -> Result<u16> {
    Ok(TcpListener::bind(("127.0.0.1", 0))?.local_addr()?.port())
}

fn port_taken(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_err()
}

fn log_error(log: &Path) -> Option<String> {
    let mut file = File::open(log).ok()?;
    let length = file.metadata().ok()?.len();
    file.seek(SeekFrom::Start(length.saturating_sub(LOG_TAIL_BYTES))).ok()?;
    let mut tail = String::new();
    file.read_to_string(&mut tail).ok()?;
    let lines: Vec<&str> = tail.lines().map(str::trim).filter(|line| !line.is_empty()).collect();
    let line = lines
        .iter()
        .rev()
        .find(|line| {
            let lower = line.to_lowercase();
            lower.contains("error") || lower.contains("failed")
        })
        .or(lines.last())?;
    let message = line.split_once(": ").map_or(*line, |(_, rest)| rest);
    Some(message.chars().take(MAX_ERROR_CHARS).collect())
}

fn server_command(binary: &Path, weights: Weights, options: ServerOptions, port: u16, key: &str) -> Command {
    let mut command = Command::new(binary);
    command.arg("--model").arg(weights.model);
    if let Some(projector) = weights.projector {
        command.arg("--mmproj").arg(projector);
        if !options.use_gpu {
            command.arg("--no-mmproj-offload");
        }
    }
    command
        .args(["--host", "127.0.0.1", "--port", &port.to_string()])
        .args(["--ctx-size", &options.context_size.to_string()])
        .args(["--n-gpu-layers", if options.use_gpu { ALL_GPU_LAYERS } else { "0" }])
        .args(["--parallel", "1", "--jinja", "--no-webui", "--api-key", key]);
    if options.threads > 0 {
        command.args(["--threads", &options.threads.to_string()]);
    }
    if let Some(dir) = binary.parent() {
        command.current_dir(dir);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    // The server must not outlive a crashed app. Spawning happens on a long-lived async worker
    // thread, so the parent-death signal only fires when the app itself goes away.
    #[cfg(target_os = "linux")]
    unsafe {
        use std::os::unix::process::CommandExt;
        command.pre_exec(|| {
            libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL);
            Ok(())
        });
    }
    command
}

impl Engine {
    pub fn new(dir: PathBuf, client: reqwest::Client) -> Self {
        Self {
            files: CatalogFiles::new(dir, client.clone()),
            client,
            starting: tokio::sync::Mutex::new(()),
            server: Lock::new(None),
            in_use: AtomicUsize::new(0),
            last_used: Lock::new(Instant::now()),
        }
    }

    fn build_dir(&self) -> PathBuf {
        self.files.path(ENGINE_BUILD)
    }

    fn binary(&self) -> Option<PathBuf> {
        find_server(&self.build_dir(), MAX_SEARCH_DEPTH)
    }

    pub fn info(&self) -> EngineInfo {
        let spec = engine_asset();
        let loaded_model = self
            .server.lock()
            .as_ref()
            .and_then(|server| server.model.file_name().map(|name| name.to_string_lossy().into_owned()));
        EngineInfo {
            available: spec.is_some(),
            installed: self.binary().is_some(),
            installing: self.files.downloads().is_running(ENGINE_BUILD),
            build: ENGINE_BUILD,
            download_bytes: spec.map_or(0, |spec| spec.size),
            installed_bytes: self.installed_bytes(),
            loaded_model,
        }
    }

    pub fn installed_bytes(&self) -> u64 {
        folder_bytes(&self.build_dir())
    }

    pub fn cancel_install(&self) {
        if let Some(spec) = engine_asset() {
            self.files.downloads().cancel(spec.file);
        }
    }

    pub async fn install(&self, on_progress: impl Fn(Progress)) -> Result<bool> {
        let spec = engine_asset()
            .ok_or_else(|| Error::Message("The built-in AI engine isn't available for this computer yet.".into()))?;
        let _installing = self.files.downloads().begin(ENGINE_BUILD, &busy_message(spec.name))?;
        if !self.files.download(&spec, on_progress).await? {
            return Ok(false);
        }
        let archive = self.files.path(spec.file);
        let staging = self.files.path(&format!("{ENGINE_BUILD}{STAGING_SUFFIX}"));
        let _ = fs::remove_dir_all(&staging);
        let unpacked = extract(&archive, &staging).and_then(|()| {
            let server = find_server(&staging, MAX_SEARCH_DEPTH)
                .ok_or_else(|| Error::Message("The AI engine download didn't contain a server.".into()))?;
            prune(server.parent().unwrap_or(&staging))
        });
        let _ = fs::remove_file(&archive);
        if let Err(error) = unpacked {
            let _ = fs::remove_dir_all(&staging);
            return Err(error);
        }
        self.stop();
        self.remove_builds()?;
        fs::rename(&staging, self.build_dir())?;
        Ok(true)
    }

    fn remove_builds(&self) -> Result<()> {
        let Ok(entries) = fs::read_dir(self.files.dir()) else {
            return Ok(());
        };
        for entry in entries.flatten().filter(|entry| entry.path().is_dir()) {
            let name = entry.file_name().to_string_lossy().into_owned();
            if !name.ends_with(STAGING_SUFFIX) {
                fs::remove_dir_all(entry.path())?;
            }
        }
        Ok(())
    }

    pub fn uninstall(&self) -> Result<()> {
        self.stop();
        self.remove_builds()
    }

    pub fn begin_use(&self) -> InUse<'_> {
        self.in_use.fetch_add(1, Ordering::Relaxed);
        InUse { engine: self }
    }

    fn current(&self, weights: Weights, options: ServerOptions) -> Option<(Connection, bool)> {
        let mut server = self.server.lock();
        let current = server.as_mut()?;
        if current.is_running() && current.runs(weights) && current.options == options {
            return Some((current.connection.clone(), current.ready));
        }
        if let Some(stale) = server.take() {
            stale.stop();
        }
        None
    }

    fn spawn(&self, weights: Weights, options: ServerOptions) -> Result<Connection> {
        let binary =
            self.binary().ok_or_else(|| Error::Message("Install the AI engine in Settings > AI first.".into()))?;
        let port = free_port()?;
        let connection = Connection { base_url: format!("http://127.0.0.1:{port}"), api_key: secret()? };
        let log = File::create(self.files.path(LOG_FILE))?;
        let child = server_command(&binary, weights, options, port, &connection.api_key)
            .stdin(Stdio::null())
            .stdout(log.try_clone()?)
            .stderr(log)
            .spawn()?;
        let server = Server {
            child,
            port,
            model: weights.model.to_path_buf(),
            projector: weights.projector.map(Path::to_path_buf),
            options,
            connection: connection.clone(),
            ready: false,
        };
        *self.server.lock() = Some(server);
        Ok(connection)
    }

    pub async fn ensure(
        &self,
        weights: Weights<'_>,
        options: ServerOptions,
        on_loading: impl Fn(),
    ) -> Result<Connection> {
        let _starting = self.starting.lock().await;
        let mut connection = match self.current(weights, options) {
            Some((connection, true)) => return Ok(connection),
            Some((connection, false)) => connection,
            None => self.spawn(weights, options)?,
        };
        on_loading();
        for attempt in 1..=START_ATTEMPTS {
            match self.wait_until_ready(&connection).await {
                Ok(Startup::Ready) => {
                    if let Some(server) = self.server.lock().as_mut() {
                        server.ready = true;
                    }
                    return Ok(connection);
                }
                Ok(Startup::PortTaken) if attempt < START_ATTEMPTS => {
                    self.stop();
                    connection = self.spawn(weights, options)?;
                }
                Ok(Startup::PortTaken) => break,
                Err(error) => {
                    self.stop();
                    return Err(error);
                }
            }
        }
        self.stop();
        Err(Error::Message("The model couldn't find a free port to start on.".into()))
    }

    async fn wait_until_ready(&self, connection: &Connection) -> Result<Startup> {
        let log = self.files.path(LOG_FILE);
        let url = format!("{}/health", connection.base_url);
        let started = Instant::now();
        while started.elapsed() < START_TIMEOUT {
            let status = self.server.lock().as_mut().map(|server| (server.is_running(), server.port));
            match status {
                Some((true, _)) => {}
                Some((false, port)) if port_taken(port) => return Ok(Startup::PortTaken),
                _ => {
                    let reason = log_error(&log).unwrap_or_else(|| "it stopped unexpectedly".into());
                    return Err(Error::Message(format!("The model couldn't start: {reason}")));
                }
            }
            let health = self.client.get(&url).bearer_auth(&connection.api_key).send().await;
            if health.is_ok_and(|response| response.status().is_success()) {
                return Ok(Startup::Ready);
            }
            tokio::time::sleep(HEALTH_POLL).await;
        }
        Err(Error::Message("The model took too long to load.".into()))
    }

    pub fn stop(&self) {
        if let Some(server) = self.server.lock().take() {
            server.stop();
        }
    }

    pub fn stop_using(&self, file: &Path) {
        if let Some(current) = self.server.lock().take_if(|current| current.uses(file)) {
            current.stop();
        }
    }

    pub fn stop_if_unused(&self) {
        if self.in_use.load(Ordering::Relaxed) == 0 {
            self.stop();
        }
    }

    pub fn stop_if_idle(&self, keep_loaded_minutes: u32) {
        if keep_loaded_minutes == 0 || self.in_use.load(Ordering::Relaxed) > 0 {
            return;
        }
        let idle = self.last_used.lock().elapsed();
        if idle >= Duration::from_secs(u64::from(keep_loaded_minutes) * 60) {
            self.stop();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        crate::shared::testing::install_tls();
        crate::shared::testing::temp_dir(&format!("engine-{name}"))
    }

    #[test]
    fn keeps_only_the_server_and_its_libraries() {
        let dir = temp_dir("prune");
        for name in [
            SERVER_NAME,
            "llama-cli",
            "libllama.so.0",
            "libllama-server-impl.so",
            "libllama-cli-impl.so",
            "ggml.dll",
            "LICENSE",
            "README.md",
        ] {
            fs::write(dir.join(name), b"x").unwrap();
        }
        prune(&dir).unwrap();
        let mut left: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .collect();
        left.sort();
        let mut expected = vec![SERVER_NAME, "LICENSE", "ggml.dll", "libllama-server-impl.so", "libllama.so.0"];
        expected.sort();
        assert_eq!(left, expected);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn finds_the_server_inside_the_unpacked_folder() {
        let dir = temp_dir("find");
        assert!(find_server(&dir, MAX_SEARCH_DEPTH).is_none());
        fs::create_dir_all(dir.join("llama-b1/bin")).unwrap();
        fs::write(dir.join("llama-b1/bin").join(SERVER_NAME), b"x").unwrap();
        assert_eq!(find_server(&dir, MAX_SEARCH_DEPTH), Some(dir.join("llama-b1/bin").join(SERVER_NAME)));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn reads_the_last_error_from_the_server_log() {
        let dir = temp_dir("log");
        let log = dir.join(LOG_FILE);
        fs::write(&log, "0.01 I srv load_model: loading\n0.02 E llama_model_load: error loading model: bad magic\n0.03 I srv done\n").unwrap();
        assert_eq!(log_error(&log).as_deref(), Some("error loading model: bad magic"));
        fs::write(&log, "just one line\n").unwrap();
        assert_eq!(log_error(&log).as_deref(), Some("just one line"));
        assert_eq!(log_error(&dir.join("missing")), None);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn idle_servers_stop_only_after_the_keep_time() {
        let engine = Engine::new(temp_dir("idle"), reqwest::Client::new());
        drop(engine.begin_use());
        engine.stop_if_idle(15);
        assert_eq!(engine.in_use.load(Ordering::Relaxed), 0);
        let _using = engine.begin_use();
        assert_eq!(engine.in_use.load(Ordering::Relaxed), 1);
    }

    fn arguments(command: &Command) -> Vec<String> {
        command.get_args().map(|arg| arg.to_string_lossy().into_owned()).collect()
    }

    #[test]
    fn vision_servers_load_the_projector_on_the_chosen_device() {
        let (model, projector) = (Path::new("m.gguf"), Path::new("vision/p.gguf"));
        let gpu = ServerOptions { context_size: 4096, use_gpu: true, threads: 0 };
        let text = arguments(&server_command(Path::new("s"), Weights { model, projector: None }, gpu, 1, "k"));
        assert!(!text.iter().any(|arg| arg.contains("mmproj")));
        let vision = Weights { model, projector: Some(projector) };
        let on_gpu = arguments(&server_command(Path::new("s"), vision, gpu, 1, "k"));
        let at = on_gpu.iter().position(|arg| arg == "--mmproj").unwrap();
        assert_eq!(on_gpu[at + 1], "vision/p.gguf");
        assert!(!on_gpu.iter().any(|arg| arg == "--no-mmproj-offload"));
        let cpu = ServerOptions { use_gpu: false, ..gpu };
        let on_cpu = arguments(&server_command(Path::new("s"), vision, cpu, 1, "k"));
        assert!(on_cpu.iter().any(|arg| arg == "--no-mmproj-offload"));
    }

    #[test]
    #[ignore = "needs a llama-server and model; set CN_LLAMA_SERVER_DIR and CN_LLAMA_MODEL"]
    fn starts_a_real_server_and_reuses_it() {
        let (Ok(server_dir), Ok(model)) = (std::env::var("CN_LLAMA_SERVER_DIR"), std::env::var("CN_LLAMA_MODEL"))
        else {
            return;
        };
        let dir = temp_dir("real");
        let build = dir.join(ENGINE_BUILD);
        fs::create_dir_all(&build).unwrap();
        for entry in fs::read_dir(&server_dir).unwrap().flatten() {
            #[cfg(unix)]
            std::os::unix::fs::symlink(entry.path(), build.join(entry.file_name())).unwrap();
        }
        let engine = Engine::new(dir.clone(), reqwest::Client::new());
        assert!(engine.info().installed);
        let options = ServerOptions { context_size: 4096, use_gpu: true, threads: 0 };
        let model = PathBuf::from(model);
        let weights = Weights { model: &model, projector: None };
        let first = tauri::async_runtime::block_on(engine.ensure(weights, options, || {})).unwrap();
        let again = tauri::async_runtime::block_on(engine.ensure(weights, options, || {})).unwrap();
        assert_eq!(first.base_url, again.base_url);
        assert!(engine.info().loaded_model.is_some());
        engine.stop();
        assert!(engine.info().loaded_model.is_none());
        fs::remove_dir_all(&dir).unwrap();
    }
}
