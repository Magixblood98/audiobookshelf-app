import { Preferences } from '@capacitor/preferences'

/**
 * Listening extras kept on this device: the Up Next queue, playback speed per book, star ratings, and the
 * related settings. components/listening/Controller.vue reacts to the player using these.
 */

const KEYS = { queue: 'upNextQueue', speeds: 'bookSpeeds', ratings: 'bookRatings', settings: 'listeningSettings', log: 'listenLog' }
const LOG_LIMIT = 400
export const DEFAULT_SETTINGS = { continueSeries: true, perBookSpeed: true, deleteFinished: false, startPage: '/bookshelf' }
export const START_PAGES = [
  ['/bookshelf', 'Home'],
  ['/bookshelf/library', 'Library'],
  ['/up-next', 'Up next'],
  ['/librarian', 'Librarian']
]

/** The server id for an item, whether it was opened from the server or from a download */
export function serverIdOf(item) {
  if (!item) return null
  if (String(item.id || '').startsWith('local')) return item.libraryItemId || null
  return item.id
}

class Listening {
  constructor({ store, $db }) {
    this.store = store
    this.db = $db
    this.loaded = this.load()
  }

  get state() {
    return this.store.state.listening
  }

  get eventBus() {
    return this.store.$eventBus
  }

  async read(key, fallback) {
    try {
      const { value } = await Preferences.get({ key })
      return value ? JSON.parse(value) : fallback
    } catch (error) {
      console.error('[Listening] Failed to read', key, error)
      return fallback
    }
  }

  async write(key, value) {
    try {
      await Preferences.set({ key, value: JSON.stringify(value) })
    } catch (error) {
      console.error('[Listening] Failed to save', key, error)
    }
  }

  async load() {
    const [queue, speeds, ratings, settings, log] = await Promise.all([this.read(KEYS.queue, []), this.read(KEYS.speeds, {}), this.read(KEYS.ratings, {}), this.read(KEYS.settings, {}), this.read(KEYS.log, [])])
    this.store.commit('listening/setAll', { queue, speeds, ratings, log, settings: { ...DEFAULT_SETTINGS, ...settings } })
  }

  /* ---------- Up Next queue ---------- */

  entryFor(item) {
    const md = item.media?.metadata || {}
    const id = serverIdOf(item) || item.id
    return {
      id,
      localId: String(item.id).startsWith('local') ? item.id : null,
      title: md.title || 'Untitled',
      author: md.authorName || (md.authors || []).map((a) => a.name).join(', '),
      added: Date.now()
    }
  }

  async setQueue(queue) {
    this.store.commit('listening/setQueue', queue)
    await this.write(KEYS.queue, queue)
  }

  /** Add a book to Up Next; next=true puts it first. A book already queued moves instead of doubling up. */
  async enqueue(item, { next = false } = {}) {
    await this.loaded
    const entry = this.entryFor(item)
    const queue = this.state.queue.filter((e) => e.id !== entry.id)
    if (next) queue.unshift(entry)
    else queue.push(entry)
    await this.setQueue(queue)
    return entry
  }

  async removeFromQueue(id) {
    await this.setQueue(this.state.queue.filter((e) => e.id !== id))
  }

  async moveInQueue(id, delta) {
    const queue = [...this.state.queue]
    const i = queue.findIndex((e) => e.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= queue.length) return
    ;[queue[i], queue[j]] = [queue[j], queue[i]]
    await this.setQueue(queue)
  }

  async clearQueue() {
    await this.setQueue([])
  }

  /** Take the next book off the queue, skipping the one that's playing */
  async shiftQueue(currentId) {
    await this.loaded
    const queue = this.state.queue.filter((e) => e.id !== currentId)
    const next = queue.shift() || null
    await this.setQueue(queue)
    return next
  }

  /** Play a queued book, from its download when there is one */
  async playEntry(entry, { startTime } = {}) {
    let local = null
    if (entry.localId) local = { id: entry.localId }
    else if (entry.id && !entry.id.startsWith('local')) local = await this.db.getLocalLibraryItemByLId(entry.id).catch(() => null)
    const extra = startTime != null ? { startTime } : {}
    if (local?.id) {
      this.eventBus.$emit('play-item', { libraryItemId: local.id, serverLibraryItemId: entry.id && !entry.id.startsWith('local') ? entry.id : null, ...extra })
    } else {
      this.eventBus.$emit('play-item', { libraryItemId: entry.id, ...extra })
    }
  }

  /* ---------- Per-book speed ---------- */

  speedFor(id) {
    return id ? this.state.speeds[id] || null : null
  }

  async setSpeed(id, speed) {
    if (!id || !speed || this.state.speeds[id] === speed) return
    const speeds = { ...this.state.speeds, [id]: speed }
    this.store.commit('listening/setSpeeds', speeds)
    await this.write(KEYS.speeds, speeds)
  }

  /* ---------- Ratings ---------- */

  ratingFor(id) {
    return id ? this.state.ratings[id] || 0 : 0
  }

  async setRating(id, stars) {
    if (!id) return
    const ratings = { ...this.state.ratings }
    if (stars) ratings[id] = stars
    else delete ratings[id]
    this.store.commit('listening/setRatings', ratings)
    await this.write(KEYS.ratings, ratings)
  }

  /* ---------- Listening log (this phone's sessions, recorded even while offline) ---------- */

  /** Start or resume the entry for a playback session */
  async logSession(session, position) {
    await this.loaded
    const log = [...this.state.log]
    const i = log.findIndex((e) => e.id === session.id)
    const now = Date.now()
    if (i >= 0) {
      log[i] = { ...log[i], lastAt: now }
    } else {
      log.unshift({
        id: session.id,
        itemId: session.libraryItemId || null,
        localId: session.localLibraryItem?.id || null,
        title: session.displayTitle || session.mediaMetadata?.title || 'Untitled',
        author: session.displayAuthor || '',
        method: session.playMethod === 3 ? 'download' : 'stream',
        startedAt: now,
        lastAt: now,
        startPos: position,
        endPos: position,
        listened: 0,
        sync: null
      })
      if (log.length > LOG_LIMIT) log.length = LOG_LIMIT
    }
    this.store.commit('listening/setLog', log)
    await this.write(KEYS.log, log)
  }

  /** Update an entry's position; `listenedDelta` is seconds of real listening since the last update */
  async logProgress(sessionId, position, { listenedDelta = 0, sync, save = false } = {}) {
    const log = this.state.log
    const i = log.findIndex((e) => e.id === sessionId)
    if (i < 0) return
    const e = { ...log[i], endPos: position, lastAt: Date.now(), listened: (log[i].listened || 0) + listenedDelta }
    if (sync !== undefined) e.sync = sync
    const next = [...log]
    next[i] = e
    this.store.commit('listening/setLog', next)
    // Writing on every tick wears flash and battery; save on pauses, closes and every few updates
    if (save || Date.now() - (this.lastLogWrite || 0) > 60000) {
      this.lastLogWrite = Date.now()
      await this.write(KEYS.log, next)
    }
  }

  async clearLog() {
    this.store.commit('listening/setLog', [])
    await this.write(KEYS.log, [])
  }

  /* ---------- Settings ---------- */

  async updateSettings(patch) {
    await this.loaded
    const settings = { ...this.state.settings, ...patch }
    this.store.commit('listening/setSettings', settings)
    await this.write(KEYS.settings, settings)
  }
}

export default function ({ store, $db }, inject) {
  inject('listening', new Listening({ store, $db }))
}
