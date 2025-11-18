// 在 Windows 的 release 模式下避免额外的控制台窗口，请勿删除！
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    animefun_lib::run()
}
