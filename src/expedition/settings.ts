const SETTINGS_KEY = 'dndrun-settings-v1'

export interface Settings {
  sound: boolean
  largeText: boolean
}

export function readSettings(): Settings {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')
    return {
      sound: value?.sound === true,
      largeText: value?.largeText === true,
    }
  } catch {
    return { sound: false, largeText: false }
  }
}

export function writeSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Preferences are optional and must not interrupt a run.
  }
}
