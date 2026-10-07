import { registerPlugin, WebPlugin } from '@capacitor/core'

class TermuxRunnerWeb extends WebPlugin {
  async isInstalled() {
    return { installed: false }
  }

  async run() {
    throw this.unavailable('Termux is only available on Android')
  }
}

/**
 * Runs a command in Termux through its RUN_COMMAND intent (used to start Pocket Librarian).
 * Termux needs allow-external-apps = true in ~/.termux/termux.properties.
 */
const TermuxRunner = registerPlugin('TermuxRunner', {
  web: () => new TermuxRunnerWeb()
})

export { TermuxRunner }
