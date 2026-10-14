<template>
  <div class="hidden" />
</template>

<script>
import { AbsAudioPlayer, AbsFileSystem } from '@/plugins/capacitor'

const PLAYMETHOD_LOCAL = 3

/**
 * Watches the player for the listening extras:
 * - a book starts: apply the speed you last used for it
 * - you change speed: remember it for this book
 * - a book ends: play the next one from Up Next, or the next book in its series; optionally delete the
 *   finished download
 */
export default {
  data() {
    return {
      session: null,
      endedSessionId: null,
      ignoreSpeedUntil: 0,
      listeners: [],
      playing: false,
      tickTimer: null,
      lastTick: 0
    }
  },
  computed: {
    settings() {
      return this.$store.state.listening.settings
    },
    connected() {
      return !!this.$store.state.user.serverConnectionConfig && this.$store.state.networkConnected !== false
    }
  },
  methods: {
    keyOf(session) {
      if (!session || session.mediaType !== 'book') return null
      return session.libraryItemId || session.localLibraryItem?.id || null
    },
    async onSession(session) {
      this.session = session
      this.endedSessionId = null
      if (session.mediaType === 'book') this.$listening.logSession(session, session.currentTime || 0)
      const key = this.keyOf(session)
      // The player may report the previous book's speed while it loads; don't save that for this book
      this.ignoreSpeedUntil = Date.now() + 2500
      await this.$listening.loaded
      if (!key || !this.settings.perBookSpeed) return
      const speed = this.$listening.speedFor(key)
      if (speed) {
        setTimeout(() => {
          if (this.keyOf(this.session) === key) AbsAudioPlayer.setPlaybackSpeed({ value: speed })
        }, 600)
      }
    },
    onSpeedChanged(data) {
      const speed = Number(data?.value)
      const key = this.keyOf(this.session)
      if (!key || !speed || Date.now() < this.ignoreSpeedUntil || !this.settings.perBookSpeed) return
      this.$listening.setSpeed(key, speed)
    },
    onMetadata(data) {
      if (this.session && data && typeof data.currentTime === 'number' && this.session.mediaType === 'book') {
        this.$listening.logProgress(this.session.id, data.currentTime, { save: data.playerState === 'ENDED' })
      }
      if (data?.playerState !== 'ENDED' || !this.session) return
      if (this.endedSessionId === this.session.id) return
      this.endedSessionId = this.session.id
      this.onBookEnded(this.session)
    },
    onPlaybackClosed() {
      this.tick(true)
      this.stopTicking()
      this.session = null
    },
    /* ----- Progress sync when the server becomes reachable ----- */
    async onTailscaleConnected() {
      await new Promise((r) => setTimeout(r, 2000)) // let the connection settle
      const { pushed, pulled } = await this.$progressSync.syncNow()
      if (pulled.length) {
        const names = pulled.map((p) => this.titleFor(p.local)).join(', ')
        this.$toast.info(`Brought ${pulled.length === 1 ? 'a download' : pulled.length + ' downloads'} up to date with newer progress from the server: ${names}`, { timeout: 8000 })
      } else if (pushed?.ok) {
        this.$toast.info('Progress synced')
      }
    },
    titleFor(local) {
      const e = this.$store.state.listening.log.find((x) => x.itemId === local.libraryItemId)
      return e?.title || 'a book'
    },
    /* ----- Listening log ----- */
    onPlayingUpdate(data) {
      const playing = !!data?.value
      if (playing === this.playing) return
      this.playing = playing
      if (playing) {
        this.lastTick = Date.now()
        this.stopTicking()
        this.tickTimer = setInterval(() => this.tick(false), 15000)
      } else {
        this.tick(true)
        this.stopTicking()
      }
    },
    stopTicking() {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    },
    /** Record where playback is now and how long has been listened since the last tick */
    async tick(save) {
      const session = this.session
      if (!session || session.mediaType !== 'book') return
      const now = Date.now()
      const listened = this.playing || save ? Math.min(60, Math.max(0, (now - this.lastTick) / 1000)) : 0
      this.lastTick = now
      try {
        const { value } = await AbsAudioPlayer.getCurrentTime()
        if (typeof value === 'number' && value > 0) await this.$listening.logProgress(session.id, value, { listenedDelta: listened, save })
      } catch (error) {
        console.error('[Listening] Couldn’t read the position', error)
      }
    },
    onSyncFailing() {
      if (this.session) this.$listening.logProgress(this.session.id, this.lastPosition(), { sync: false, save: true })
    },
    onSyncSuccess() {
      if (this.session) this.$listening.logProgress(this.session.id, this.lastPosition(), { sync: true })
    },
    lastPosition() {
      return (this.$store.state.listening.log.find((e) => e.id === this.session?.id) || {}).endPos || 0
    },
    async onBookEnded(session) {
      if (session.mediaType !== 'book') return
      const serverId = session.libraryItemId || null
      const local = session.playMethod === PLAYMETHOD_LOCAL ? session.localLibraryItem : null

      // Give the player a moment to save the finished progress before moving on
      await new Promise((r) => setTimeout(r, 1500))

      const queued = await this.$listening.shiftQueue(serverId || local?.id)
      if (queued) {
        this.$toast.info(`Up next: ${queued.title}`)
        await this.$listening.playEntry(queued)
      } else if (this.settings.continueSeries && serverId) {
        await this.continueSeries(serverId)
      }

      if (local && this.settings.deleteFinished) this.deleteDownload(local)
    },
    async continueSeries(serverId) {
      if (!this.connected) return
      try {
        const item = await this.$nativeHttp.get(`/api/items/${serverId}?expanded=1`)
        const series = (item?.media?.metadata?.series || [])[0]
        if (!series) return
        const res = await this.$nativeHttp.get(`/api/libraries/${item.libraryId}/items?filter=series.${this.$encode(series.id)}&limit=200&minified=1`)
        const books = (res?.results || [])
          .map((b) => ({ id: b.id, title: b.media?.metadata?.title, seq: parseFloat(b.media?.metadata?.series?.sequence) }))
          .sort((a, b) => (isNaN(a.seq) ? 1e9 : a.seq) - (isNaN(b.seq) ? 1e9 : b.seq))
        const current = parseFloat(series.sequence)
        const i = books.findIndex((b) => b.id === serverId)
        const later = books.filter((b, j) => b.id !== serverId && (!isNaN(current) && !isNaN(b.seq) ? b.seq > current : j > i))
        const next = later.find((b) => !this.$store.getters['user/getUserMediaProgress'](b.id)?.isFinished)
        if (next) {
          this.$toast.info(`Next in ${series.name}: ${next.title}`)
          await this.$listening.playEntry({ id: next.id })
        } else {
          this.$toast.info(`That was the last ${series.name} book you have. Tap to see what’s missing.`, {
            timeout: 10000,
            onClick: () => this.$router.push(`/series-missing/${series.id}`)
          })
        }
      } catch (error) {
        console.error('[Listening] Couldn’t continue the series', error)
      }
    },
    async deleteDownload(local) {
      // Wait so the finished progress is saved and the next book has started
      await new Promise((r) => setTimeout(r, 8000))
      try {
        const item = await this.$db.getLocalLibraryItem(local.id)
        if (!item) return
        const res = await AbsFileSystem.deleteItem(item)
        if (res?.success) this.$toast.info(`Finished, so its download was removed: ${item.media?.metadata?.title || 'book'}`)
      } catch (error) {
        console.error('[Listening] Couldn’t delete the finished download', error)
      }
    }
  },
  async mounted() {
    this.$eventBus.$on('tailscale-connected', this.onTailscaleConnected)
    this.listeners = await Promise.all([
      AbsAudioPlayer.addListener('onPlaybackSession', this.onSession),
      AbsAudioPlayer.addListener('onPlaybackSpeedChanged', this.onSpeedChanged),
      AbsAudioPlayer.addListener('onMetadata', this.onMetadata),
      AbsAudioPlayer.addListener('onPlaybackClosed', this.onPlaybackClosed),
      AbsAudioPlayer.addListener('onPlayingUpdate', this.onPlayingUpdate),
      AbsAudioPlayer.addListener('onProgressSyncFailing', this.onSyncFailing),
      AbsAudioPlayer.addListener('onProgressSyncSuccess', this.onSyncSuccess)
    ])
  },
  beforeDestroy() {
    this.$eventBus.$off('tailscale-connected', this.onTailscaleConnected)
    this.stopTicking()
    this.listeners.forEach((l) => l && l.remove && l.remove())
  }
}
</script>
