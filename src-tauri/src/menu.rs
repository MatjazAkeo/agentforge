// src-tauri/src/menu.rs
use tauri::menu::{Menu, MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Runtime};

pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let new_item = MenuItem::with_id(app, "menu.file.new", "New", true, Some("CmdOrCtrl+N"))?;
    let open_item = MenuItem::with_id(app, "menu.file.open", "Open…", true, Some("CmdOrCtrl+O"))?;
    let save_item = MenuItem::with_id(app, "menu.file.save", "Save", true, Some("CmdOrCtrl+S"))?;
    let save_as_item = MenuItem::with_id(
        app,
        "menu.file.save_as",
        "Save As…",
        true,
        Some("CmdOrCtrl+Shift+S"),
    )?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_item)
        .item(&open_item)
        .separator()
        .item(&save_item)
        .item(&save_as_item)
        .build()?;

    let run_item = MenuItem::with_id(app, "menu.run.run", "Run", true, Some("CmdOrCtrl+Return"))?;
    let stop_item = MenuItem::with_id(app, "menu.run.stop", "Stop", true, Some("CmdOrCtrl+."))?;

    let run_menu = SubmenuBuilder::new(app, "Run")
        .item(&run_item)
        .item(&stop_item)
        .build()?;

    MenuBuilder::new(app)
        .item(&file_menu)
        .item(&run_menu)
        .build()
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event_id: &str) {
    let _ = app.emit("menu", event_id);
}
