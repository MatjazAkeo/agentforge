use keyring::Entry;

const SERVICE: &str = "agent-playground";
const ACCOUNT_API_KEY: &str = "openrouter.api_key";

#[tauri::command]
pub fn save_api_key(key: String) -> Result<(), String> {
    Entry::new(SERVICE, ACCOUNT_API_KEY)
        .map_err(|e| e.to_string())?
        .set_password(&key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_api_key() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, ACCOUNT_API_KEY).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_api_key() -> Result<(), String> {
    let entry = Entry::new(SERVICE, ACCOUNT_API_KEY).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
