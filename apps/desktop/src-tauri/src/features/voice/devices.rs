use crate::shared::error::{Error, Result};
use cpal::traits::{DeviceTrait, HostTrait};
use cpal::{Device, Host};
use serde::Serialize;

#[derive(Debug, Serialize, PartialEq)]
pub struct Microphone {
    pub id: String,
    pub name: String,
}

pub(super) fn audio(e: cpal::Error) -> Error {
    Error::Message(format!("Couldn't use the microphone: {e}"))
}

fn id_of(device: &Device) -> Option<String> {
    device.id().ok().map(|id| id.to_string())
}

fn host() -> Host {
    #[cfg(target_os = "linux")]
    if let Ok(server) = cpal::host_from_id(cpal::HostId::PulseAudio) {
        return server;
    }
    cpal::default_host()
}

fn is_microphone(id: &str) -> bool {
    match id.strip_prefix("alsa:") {
        Some(alsa) => alsa == "default" || alsa.starts_with("sysdefault:CARD="),
        None => !id.ends_with(".monitor"),
    }
}

fn microphones(host: &Host) -> Result<impl Iterator<Item = (String, Device)>> {
    let devices = host.input_devices().map_err(audio)?;
    Ok(devices.filter_map(|device| Some((id_of(&device)?, device))).filter(|(id, _)| is_microphone(id)))
}

pub fn list_microphones() -> Result<Vec<Microphone>> {
    Ok(microphones(&host())?
        .filter_map(|(id, device)| Some(Microphone { id, name: device.description().ok()?.name().to_owned() }))
        .collect())
}

pub fn find(id: Option<&str>) -> Result<Device> {
    let host = host();
    let chosen = id.and_then(|id| microphones(&host).ok()?.find(|(found, _)| found == id).map(|(_, device)| device));
    chosen.or_else(|| host.default_input_device()).ok_or_else(|| Error::Message("No microphone found.".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sound_server_inputs_are_kept_but_output_monitors_are_not() {
        assert!(is_microphone("pulseaudio:alsa_input.usb-Audient_EVO4-00.HiFi__Mic1__source"));
        assert!(!is_microphone("pulseaudio:alsa_output.pci-0000_01_00.1.hdmi-stereo.monitor"));
    }

    #[test]
    fn alsa_keeps_only_the_default_and_one_entry_per_card() {
        assert!(is_microphone("alsa:default"));
        assert!(is_microphone("alsa:sysdefault:CARD=EVO4"));
        for plugin in ["alsa:null", "alsa:pipewire", "alsa:front:CARD=EVO4,DEV=0", "alsa:surround51:CARD=Generic"] {
            assert!(!is_microphone(plugin), "{plugin} should be hidden");
        }
    }

    #[test]
    fn other_platforms_keep_every_input() {
        assert!(is_microphone("wasapi:{0.0.1.00000000}.{6f1b}"));
        assert!(is_microphone("coreaudio:BuiltInMicrophoneDevice"));
    }
}
