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
      listeners: []
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
      if (data?.playerState !== 'ENDED' || !this.session) return
      if (this.endedSessionId === this.session.id) return
      this.endedSessionId = this.session.id
      this.onBookEnded(this.session)
    },
    onPlaybackClosed() {
      this.session = null
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
    this.listeners = await Promise.all([
      AbsAudioPlayer.addListener('onPlaybackSession', this.onSession),
      AbsAudioPlayer.addListener('onPlaybackSpeedChanged', this.onSpeedChanged),
      AbsAudioPlayer.addListener('onMetadata', this.onMetadata),
      AbsAudioPlayer.addListener('onPlaybackClosed', this.onPlaybackClosed)
    ])
  },
  beforeDestroy() {
    this.listeners.forEach((l) => l && l.remove && l.remove())
  }
}
</script>
