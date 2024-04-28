// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// use tauri_plugin_autostart::MacosLauncher;
// use tauri_plugin_autostart::ManagerExt;
fn main() {
    tauri::Builder::default()
        // .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        // .plugin(tauri_plugin_autostart::init(
        //     MacosLauncher::LaunchAgent,
        //     Some(vec![]),
        // ))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![save_img,get_paddle_ocr_json_result])
        // .setup(|app| {
        //     let autostart_manager = app.autolaunch();
        //     let _ = autostart_manager.enable();
        //     let _ = autostart_manager.disable();
        //     Ok(())
        // })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


use image::open;
#[tauri::command]
fn save_img(path:&str,x:u32,y:u32,width:u32,height:u32,savepath:&str){
    let mut img = open(path).unwrap();
    let imgcrop = img.crop(x, y, width, height);
    
    let _ = imgcrop.save(savepath);
}

#[tauri::command]
fn get_paddle_ocr_json_result(exepath:&str,imagepath:&str)->String{
    use std::path::{Path, PathBuf};
    let mut p = paddleocr::Ppocr::new(
        PathBuf::from(exepath), // path to binary
        Default::default(), // language config_path, default `zh_CN`
    )
    .unwrap(); // initialize
    return p.ocr(Path::new(imagepath).into()).unwrap()   
    // let now = std::time::Instant::now(); // benchmark
    // {
    //     // OCR files
        
    // }
}