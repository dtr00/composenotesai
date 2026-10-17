use crate::shared::lock::Lock;
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;
use sysinfo::{Disks, Pid, ProcessRefreshKind, ProcessesToUpdate, System};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    cpu_name: String,
    cores: Option<usize>,
    threads: usize,
    arch: String,
    os: Option<String>,
    instruction_sets: Vec<&'static str>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemUsage {
    cpu_percent: f32,
    app_cpu_percent: f32,
    memory_total: u64,
    memory_used: u64,
    memory_available: u64,
    app_memory: u64,
    swap_total: u64,
    swap_used: u64,
    disk_total: u64,
    disk_available: u64,
}

pub struct SystemMonitor {
    system: Lock<System>,
}

fn instruction_sets() -> Vec<&'static str> {
    #[cfg_attr(not(any(target_arch = "x86", target_arch = "x86_64", target_arch = "aarch64")), allow(unused_mut))]
    let mut sets = Vec::new();
    #[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
    for (name, present) in [
        ("AVX", std::arch::is_x86_feature_detected!("avx")),
        ("AVX2", std::arch::is_x86_feature_detected!("avx2")),
        ("AVX-512", std::arch::is_x86_feature_detected!("avx512f")),
        ("FMA", std::arch::is_x86_feature_detected!("fma")),
        ("F16C", std::arch::is_x86_feature_detected!("f16c")),
    ] {
        if present {
            sets.push(name);
        }
    }
    #[cfg(target_arch = "aarch64")]
    for (name, present) in [
        ("NEON", std::arch::is_aarch64_feature_detected!("neon")),
        ("Dot product", std::arch::is_aarch64_feature_detected!("dotprod")),
        ("I8MM", std::arch::is_aarch64_feature_detected!("i8mm")),
    ] {
        if present {
            sets.push(name);
        }
    }
    sets
}

fn with_descendants(root: u32, parents: &[(u32, Option<u32>)]) -> HashSet<u32> {
    let mut family = HashSet::from([root]);
    loop {
        let before = family.len();
        for (pid, parent) in parents {
            if parent.is_some_and(|parent| family.contains(&parent)) {
                family.insert(*pid);
            }
        }
        if family.len() == before {
            return family;
        }
    }
}

#[cfg(target_os = "linux")]
fn proportional_memory(pid: u32) -> Option<u64> {
    let rollup = std::fs::read_to_string(format!("/proc/{pid}/smaps_rollup")).ok()?;
    let line = rollup.lines().find(|line| line.starts_with("Pss:"))?;
    let kib: u64 = line.split_whitespace().nth(1)?.parse().ok()?;
    Some(kib * 1024)
}

#[cfg(not(target_os = "linux"))]
fn proportional_memory(_pid: u32) -> Option<u64> {
    None
}

fn disk_space(data_dir: &Path) -> (u64, u64) {
    let disks = Disks::new_with_refreshed_list();
    disks
        .list()
        .iter()
        .filter(|disk| data_dir.starts_with(disk.mount_point()))
        .max_by_key(|disk| disk.mount_point().as_os_str().len())
        .map_or((0, 0), |disk| (disk.total_space(), disk.available_space()))
}

impl SystemMonitor {
    pub fn new() -> Self {
        Self { system: Lock::new(System::new()) }
    }

    pub fn info(&self) -> SystemInfo {
        let mut system = self.system.lock();
        system.refresh_cpu_usage();
        SystemInfo {
            cpu_name: system.cpus().first().map_or_else(String::new, |cpu| cpu.brand().trim().to_owned()),
            cores: System::physical_core_count(),
            threads: system.cpus().len(),
            arch: System::cpu_arch(),
            os: System::long_os_version(),
            instruction_sets: instruction_sets(),
        }
    }

    pub fn usage(&self, data_dir: &Path) -> SystemUsage {
        let mut system = self.system.lock();
        system.refresh_cpu_usage();
        system.refresh_memory();
        system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory().without_tasks(),
        );
        let parents: Vec<(u32, Option<u32>)> = system
            .processes()
            .iter()
            .map(|(pid, process)| (pid.as_u32(), process.parent().map(Pid::as_u32)))
            .collect();
        let app = with_descendants(std::process::id(), &parents);
        let app_processes = || system.processes().iter().filter(|(pid, _)| app.contains(&pid.as_u32()));
        let threads = system.cpus().len().max(1) as f32;
        let (disk_total, disk_available) = disk_space(data_dir);
        SystemUsage {
            cpu_percent: system.global_cpu_usage(),
            app_cpu_percent: app_processes().map(|(_, process)| process.cpu_usage()).sum::<f32>() / threads,
            memory_total: system.total_memory(),
            memory_used: system.used_memory(),
            memory_available: system.available_memory(),
            app_memory: app_processes()
                .map(|(pid, process)| proportional_memory(pid.as_u32()).unwrap_or(process.memory()))
                .sum(),
            swap_total: system.total_swap(),
            swap_used: system.used_swap(),
            disk_total,
            disk_available,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_every_descendant_of_the_app() {
        let parents = [(10, Some(1)), (20, Some(10)), (30, Some(20)), (40, Some(1)), (50, None)];
        assert_eq!(with_descendants(10, &parents), HashSet::from([10, 20, 30]));
        assert_eq!(with_descendants(99, &parents), HashSet::from([99]));
    }

    #[test]
    fn reports_memory_and_disk_for_the_current_machine() {
        let monitor = SystemMonitor::new();
        let usage = monitor.usage(&std::env::temp_dir());
        assert!(usage.memory_total > 0 && usage.memory_used <= usage.memory_total);
        assert!(usage.app_memory > 0);
        assert!(usage.disk_available <= usage.disk_total);
        assert!(monitor.info().threads > 0);
    }

    #[test]
    fn threads_do_not_count_as_extra_memory() {
        let (stop, wait) = std::sync::mpsc::channel::<()>();
        let wait = std::sync::Arc::new(std::sync::Mutex::new(wait));
        let workers: Vec<_> = (0..8)
            .map(|_| {
                let wait = std::sync::Arc::clone(&wait);
                std::thread::spawn(move || drop(wait.lock().map(|wait| wait.recv())))
            })
            .collect();
        let mut system = System::new();
        let own = Pid::from_u32(std::process::id());
        let memory_only = ProcessRefreshKind::nothing().with_memory();
        system.refresh_processes_specifics(ProcessesToUpdate::Some(&[own]), true, memory_only);
        let resident = system.process(own).map_or(0, |process| process.memory());
        let app_memory = SystemMonitor::new().usage(&std::env::temp_dir()).app_memory;
        drop(stop);
        workers.into_iter().for_each(|worker| drop(worker.join()));
        assert!(app_memory <= resident * 2, "{app_memory} counted for {resident} resident");
    }
}
