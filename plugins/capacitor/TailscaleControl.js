import { registerPlugin, WebPlugin } from '@capacitor/core'

class TailscaleControlWeb extends WebPlugin {
  async status() {
    return { installed: false, connected: false }
  }

  async connect() {
    throw this.unavailable('Tailscale control is only available on Android')
  }

  async disconnect() {
    throw this.unavailable('Tailscale control is only available on Android')
  }
}

/** Turn the Tailscale VPN on or off and check whether it's connected (Android) */
const TailscaleControl = registerPlugin('TailscaleControl', {
  web: () => new TailscaleControlWeb()
})

export { TailscaleControl }
