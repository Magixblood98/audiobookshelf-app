export const state = () => ({
  installed: false,
  connected: false,
  busy: false
})

export const mutations = {
  setStatus(state, { installed, connected }) {
    state.installed = !!installed
    state.connected = !!connected
  },
  setBusy(state, busy) {
    state.busy = busy
  }
}
