export const state = () => ({
  loaded: false,
  queue: [],
  speeds: {},
  ratings: {},
  settings: { continueSeries: true, perBookSpeed: true, deleteFinished: false, startPage: '/bookshelf' }
})

export const mutations = {
  setAll(state, data) {
    Object.assign(state, data, { loaded: true })
  },
  setQueue(state, queue) {
    state.queue = queue
  },
  setSpeeds(state, speeds) {
    state.speeds = speeds
  },
  setRatings(state, ratings) {
    state.ratings = ratings
  },
  setSettings(state, settings) {
    state.settings = settings
  }
}
