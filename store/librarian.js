export const state = () => ({
  config: { url: 'http://127.0.0.1:5300', apiKey: '' },
  online: null,
  needsKey: false,
  starting: false,
  status: null
})

export const getters = {
  activeCount: (state) => state.status?.counts?.active || 0
}

export const mutations = {
  setConfig(state, config) {
    state.config = config
  },
  setOnline(state, online) {
    state.online = online
  },
  setNeedsKey(state, needsKey) {
    state.needsKey = needsKey
  },
  setStarting(state, starting) {
    state.starting = starting
  },
  setStatus(state, status) {
    state.status = status
  }
}
