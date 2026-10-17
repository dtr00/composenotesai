#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK's DMA-BUF renderer crashes on Wayland with NVIDIA drivers
    // ("Error 71 (Protocol error) dispatching to Wayland display").
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    // WebKitGTK fails with "Failed to decode data" after seeking when GStreamer picks a
    // VA-API hardware decoder, so videos use the software decoders instead.
    #[cfg(target_os = "linux")]
    if std::env::var_os("GST_PLUGIN_FEATURE_RANK").is_none() {
        std::env::set_var(
            "GST_PLUGIN_FEATURE_RANK",
            "vah264dec:NONE,vah265dec:NONE,vavp8dec:NONE,vavp9dec:NONE,vaav1dec:NONE,vampeg2dec:NONE,\
             vaapih264dec:NONE,vaapih265dec:NONE,vaapivp8dec:NONE,vaapivp9dec:NONE,vaapiav1dec:NONE",
        );
    }

    composenotesai_lib::run()
}
