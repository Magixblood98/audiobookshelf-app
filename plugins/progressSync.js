/**
 * Keeps downloaded books' positions in step with the server when the connection comes and goes.
 *
 * The app only hears about progress made elsewhere (another device, the Teams bot) through its live socket. With
 * Tailscale off it misses those updates, then plays the download from its old position. And positions recorded
 * while offline stay on the phone until they're uploaded. So:
 * - push(): upload this phone's local listening sessions
 * - pull(): bring newer server positions into downloaded copies (newest wins)
 * - beforeLocalPlay(): check one book's server position right before playing its download
 */
class ProgressSync {
  constructor({ store, $db, $nativeHttp, $tailscale }) {
    this.store = store
    this.db = $db
    this.http = $nativeHttp
    this.running = null
    // Upload before Tailscale is switched off, so the server has the latest position
    if ($tailscale) $tailscale.beforeDisconnect = () => this.push().catch(() => {})
  }

  get connected() {
    return !!this.store.state.user.user && !!this.store.state.user.serverConnectionConfig
  }

  get userId() {
    return this.store.state.user.user?.id
  }

  async push() {
    if (!this.connected) return { ok: false, error: 'Not connected to the server' }
    const res = await this.db.syncLocalSessionsWithServer(false)
    if (res?.error) return { ok: false, error: res.error }
    await this.store.dispatch('globals/loadLocalMediaProgress')
    return { ok: true }
  }

  /** Server progress for one book, or null (none yet, or the server can't be reached quickly) */
  async serverProgress(libraryItemId, timeoutMs) {
    try {
      return await Promise.race([
        this.http.get(`/api/me/progress/${libraryItemId}`, { connectTimeout: timeoutMs, readTimeout: timeoutMs }),
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs + 500))
      ])
    } catch {
      return null
    }
  }

  /** Copy the server's position into a downloaded copy when the server's is newer. Returns the new local progress. */
  async pullOne(local, timeoutMs = 6000) {
    if (!local?.libraryItemId || local.episodeId || (local.serverUserId && local.serverUserId !== this.userId)) return null
    const prog = await this.serverProgress(local.libraryItemId, timeoutMs)
    if (!prog || !prog.lastUpdate || prog.lastUpdate <= local.lastUpdate) return null
    if (prog.currentTime === local.currentTime && prog.isFinished === local.isFinished) return null
    const updated = await this.db.syncServerMediaProgressWithLocalMediaProgress({ localMediaProgressId: local.id, mediaProgress: prog })
    if (updated?.id) this.store.commit('globals/updateLocalMediaProgress', updated)
    return updated?.id ? { local, server: prog } : null
  }

  async pull() {
    if (!this.connected) return []
    const all = (await this.db.getAllLocalMediaProgress()) || []
    const changed = []
    for (const local of all) {
      const r = await this.pullOne(local)
      if (r) changed.push(r)
    }
    return changed
  }

  /** Upload, then download newer positions. One at a time. */
  syncNow() {
    if (!this.running) {
      this.running = (async () => {
        const pushed = await this.push().catch((error) => ({ ok: false, error: error.message }))
        const pulled = await this.pull().catch(() => [])
        return { pushed, pulled }
      })().finally(() => (this.running = null))
    }
    return this.running
  }

  /** Right before playing a download: take the server's position if it's newer. Gives up after a few seconds. */
  async beforeLocalPlay(localLibraryItemId) {
    if (!this.connected) return null
    try {
      const all = (await this.db.getAllLocalMediaProgress()) || []
      const local = all.find((p) => p.localLibraryItemId === localLibraryItemId && !p.localEpisodeId)
      return local ? await this.pullOne(local, 3000) : null
    } catch (error) {
      console.error('[ProgressSync] before play failed', error)
      return null
    }
  }
}

export default function ({ store, $db, $nativeHttp, $tailscale, $eventBus }, inject) {
  const sync = new ProgressSync({ store, $db, $nativeHttp, $tailscale })
  inject('progressSync', sync)
}
