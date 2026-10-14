import { TailscaleControl } from '@/plugins/capacitor/TailscaleControl'

/**
 * Tailscale on/off from inside the app. Pocket Librarian and Audiobookshelf run on the Pi, which is only
 * reachable over Tailscale; the owner keeps Tailscale off to save battery and switches it on when needed.
 */
class Tailscale {
  constructor({ store }) {
    this.store = store
  }

  get state() {
    return this.store.state.tailscale
  }

  async refresh() {
    try {
      const s = await TailscaleControl.status()
      this.store.commit('tailscale/setStatus', s)
      return s
    } catch (error) {
      console.error('[Tailscale] status failed', error)
      return { installed: false, connected: false }
    }
  }

  /** Wait for the VPN to reach the wanted state; Tailscale usually connects within a few seconds */
  async waitFor(connected, seconds = 15) {
    for (let i = 0; i < seconds * 2; i++) {
      await new Promise((r) => setTimeout(r, 500))
      const s = await this.refresh()
      if (s.connected === connected) return true
    }
    return false
  }

  async setConnected(on) {
    if (this.state.busy) return false
    this.store.commit('tailscale/setBusy', true)
    try {
      await (on ? TailscaleControl.connect() : TailscaleControl.disconnect())
      const ok = await this.waitFor(on)
      if (ok && on) await new Promise((r) => setTimeout(r, 1500)) // let the tunnel start carrying traffic
      return ok
    } finally {
      this.store.commit('tailscale/setBusy', false)
    }
  }

  turnOn() {
    return this.setConnected(true)
  }

  turnOff() {
    return this.setConnected(false)
  }

  toggle() {
    return this.setConnected(!this.state.connected)
  }
}

export default function ({ store }, inject) {
  inject('tailscale', new Tailscale({ store }))
}
