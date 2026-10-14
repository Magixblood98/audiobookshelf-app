<template>
  <div class="w-full h-full overflow-y-auto px-4 py-5">
    <div class="flex items-center">
      <h1 class="text-xl font-semibold flex-grow">Listening log</h1>
      <button type="button" class="material-symbols text-2xl px-1" :class="loading ? 'animate-spin opacity-60' : ''" aria-label="Refresh" @click="load">refresh</button>
    </div>

    <!-- Totals -->
    <div class="grid grid-cols-3 gap-2 mt-4 text-center">
      <div v-for="t in totals" :key="t.label" class="rounded-md bg-bg-hover py-2">
        <p class="text-lg font-semibold">{{ t.value }}</p>
        <p class="text-xxs uppercase text-fg-muted">{{ t.label }}</p>
      </div>
    </div>

    <!-- Sync problems -->
    <div v-if="unsynced.length" class="mt-4 p-3 rounded-md border border-warning bg-warning/10 text-sm">
      <p>{{ unsynced.length === 1 ? 'One session on this phone hasn’t' : unsynced.length + ' sessions on this phone haven’t' }} reached the server yet, so other devices don’t know where you are.</p>
      <ui-btn small color="primary" class="mt-2" :loading="syncing || tailscale.busy" @click="syncNow">{{ needsTailscale ? 'Turn on Tailscale and sync' : 'Sync now' }}</ui-btn>
    </div>
    <div v-if="regressions.length" class="mt-4 p-3 rounded-md border border-error bg-error/10 text-sm">
      Your place went back {{ regressions.length === 1 ? 'once' : regressions.length + ' times' }} in this log. It usually happens when a download on this phone and another device (like the Teams bot) take turns while the phone is offline. Tap <b>Go to</b> on a marked session to jump to where you really were.
    </div>
    <p v-if="serverNote" class="text-xs text-fg-muted mt-3">{{ serverNote }}</p>

    <p v-if="!rows.length && !loading" class="py-12 text-center text-fg-muted">Nothing listened yet. Sessions show up here as you listen.</p>

    <!-- Sessions by day -->
    <div v-for="day in days" :key="day.key" class="mt-6">
      <div class="flex items-baseline">
        <h2 class="text-sm font-semibold uppercase text-fg-muted flex-grow">{{ day.label }}</h2>
        <span class="text-xs text-fg-muted">{{ fmtDuration(day.listened) }}</span>
      </div>
      <div v-for="r in day.rows" :key="r.key" class="py-2.5 border-b border-border">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 flex-none rounded overflow-hidden bg-bg-hover" @click="open(r)">
            <img v-if="r.itemId" :src="cover(r.itemId)" class="w-full h-full object-cover" loading="lazy" />
          </div>
          <div class="flex-grow min-w-0" @click="open(r)">
            <p class="text-sm truncate">{{ r.title }}</p>
            <p class="text-xs text-fg-muted">
              {{ clock(r.startedAt) }} · {{ ts(r.startPos) }} → {{ ts(r.endPos) }} · {{ fmtDuration(r.listened) }}
            </p>
            <p class="text-xs text-fg-muted flex items-center gap-1 mt-0.5">
              <span class="material-symbols text-sm">{{ r.icon }}</span>{{ r.device }}
              <template v-if="r.sync === false"><span class="material-symbols text-sm text-warning ml-1">cloud_off</span><span class="text-warning">not uploaded yet</span></template>
              <template v-else-if="r.sync === true"><span class="material-symbols text-sm ml-1">cloud_done</span>uploaded</template>
            </p>
          </div>
        </div>
        <div v-if="r.lost" class="mt-1.5 flex items-center gap-2 text-xs text-error" style="margin-left: 3.25rem">
          <span class="material-symbols text-sm">history</span>
          <span class="flex-grow">Started {{ fmtDuration(r.lost) }} behind where {{ r.lostFrom }} stopped ({{ ts(r.goTo) }})</span>
          <button type="button" class="px-2 py-1 rounded border border-error text-error" @click="goTo(r)">Go to {{ ts(r.goTo) }}</button>
        </div>
      </div>
    </div>

    <div v-if="hasMore" class="text-center py-4">
      <ui-btn small :loading="loading" @click="loadMore">Show older</ui-btn>
    </div>
    <p class="text-xxs text-fg-muted text-center mt-6">This phone’s sessions are recorded here even offline. Other devices’ sessions come from your server when it’s reachable.</p>
  </div>
</template>

<script>
const DAY = 86400000

export default {
  data() {
    return { server: [], page: 0, hasMore: false, loading: false, syncing: false, serverNote: '' }
  },
  computed: {
    tailscale() {
      return this.$store.state.tailscale
    },
    needsTailscale() {
      return this.tailscale.installed && !this.tailscale.connected
    },
    local() {
      return this.$store.state.listening.log
    },
    unsynced() {
      return this.local.filter((e) => e.method === 'download' && e.sync === false)
    },
    /** This phone's log plus the server's sessions (other devices, older history), oldest first, with jumps marked */
    rows() {
      const localIds = new Set(this.local.map((e) => e.id))
      const fromLocal = this.local.map((e) => ({
        key: 'l' + e.id,
        itemId: e.itemId,
        localId: e.localId,
        title: e.title,
        startedAt: e.startedAt,
        startPos: e.startPos,
        endPos: e.endPos,
        listened: e.listened || 0,
        device: e.method === 'download' ? 'This phone · download' : 'This phone · streaming',
        icon: e.method === 'download' ? 'download_for_offline' : 'smartphone',
        sync: e.method === 'download' ? e.sync : null
      }))
      const fromServer = this.server
        .filter((s) => !localIds.has(s.id) && !this.local.some((e) => e.itemId === s.libraryItemId && Math.abs(e.startedAt - s.startedAt) < 90000))
        .map((s) => {
          const rate = s.playbackRate || 1
          const isDownload = s.playMethod === 3
          const client = s.deviceInfo?.clientName || 'Another device'
          const phone = /^Abs (Android|iOS)/.test(client)
          return {
            key: 's' + s.id,
            itemId: s.libraryItemId,
            title: s.displayTitle || 'Untitled',
            startedAt: s.startedAt,
            // Downloads don't report where they started; work it out from where they ended and how long they played
            startPos: isDownload ? Math.max(0, s.currentTime - (s.timeListening || 0) * rate) : s.startTime || 0,
            endPos: s.currentTime || 0,
            listened: s.timeListening || 0,
            device: phone ? `Phone · ${isDownload ? 'download' : 'streaming'}` : client,
            icon: phone ? (isDownload ? 'download_for_offline' : 'smartphone') : /bot/i.test(client) ? 'smart_toy' : 'devices',
            sync: null
          }
        })
      const all = [...fromLocal, ...fromServer].filter((r) => r.listened > 5 || r.endPos - r.startPos > 5).sort((a, b) => a.startedAt - b.startedAt)
      const lastByItem = {}
      for (const r of all) {
        const key = r.itemId || r.localId
        const prev = lastByItem[key]
        if (prev && r.startPos < prev.endPos - 180) {
          r.lost = prev.endPos - r.startPos
          r.goTo = prev.endPos
          r.lostFrom = prev.device.startsWith('This phone') || prev.device.startsWith('Phone') ? 'this phone' : prev.device
        }
        if (!prev || r.endPos > 0) lastByItem[key] = r
      }
      return all.reverse()
    },
    regressions() {
      return this.rows.filter((r) => r.lost)
    },
    days() {
      const out = []
      for (const r of this.rows) {
        const d = new Date(r.startedAt)
        const key = d.toDateString()
        let day = out.find((x) => x.key === key)
        if (!day) out.push((day = { key, label: this.dayLabel(d), rows: [], listened: 0 }))
        day.rows.push(r)
        day.listened += r.listened
      }
      return out
    },
    totals() {
      const now = Date.now()
      const startOfDay = new Date().setHours(0, 0, 0, 0)
      const sum = (since) => this.rows.filter((r) => r.startedAt >= since).reduce((a, r) => a + r.listened, 0)
      return [
        { label: 'Today', value: this.fmtDuration(sum(startOfDay)) },
        { label: 'Last 7 days', value: this.fmtDuration(sum(now - 7 * DAY)) },
        { label: 'Last 30 days', value: this.fmtDuration(sum(now - 30 * DAY)) }
      ]
    }
  },
  methods: {
    ts(sec) {
      return this.$secondsToTimestamp(Math.max(0, sec || 0))
    },
    fmtDuration(sec) {
      const m = Math.round((sec || 0) / 60)
      if (m < 60) return `${m} min`
      return `${Math.floor(m / 60)} h ${m % 60} min`
    },
    clock(t) {
      return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    },
    dayLabel(d) {
      const today = new Date().toDateString()
      const yesterday = new Date(Date.now() - DAY).toDateString()
      if (d.toDateString() === today) return 'Today'
      if (d.toDateString() === yesterday) return 'Yesterday'
      return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
    },
    cover(id) {
      return this.$store.getters['globals/getLibraryItemCoverSrcById'](id)
    },
    open(r) {
      if (r.itemId || r.localId) this.$router.push(`/item/${r.itemId || r.localId}`)
    },
    async goTo(r) {
      await this.$listening.playEntry({ id: r.itemId || r.localId }, { startTime: r.goTo })
      this.$toast.info(`Playing ${r.title} from ${this.ts(r.goTo)}`)
    },
    async syncNow() {
      this.syncing = true
      try {
        if (this.needsTailscale) {
          const ok = await this.$tailscale.turnOn()
          if (!ok) return this.$toast.error('Tailscale didn’t connect. Open the Tailscale app to check it’s signed in.')
        }
        const { pushed, pulled } = await this.$progressSync.syncNow()
        if (pushed.ok) {
          // The phone's sessions are on the server now
          const log = this.local.map((e) => (e.sync === false ? { ...e, sync: true } : e))
          this.$store.commit('listening/setLog', log)
          this.$toast.success(pulled.length ? `Synced. ${pulled.length} download${pulled.length === 1 ? '' : 's'} updated from the server.` : 'Synced')
          this.load()
        } else {
          this.$toast.error(`Couldn’t sync: ${pushed.error || 'the server didn’t answer'}`)
        }
      } finally {
        this.syncing = false
      }
    },
    async fetchPage(page) {
      return await Promise.race([this.$nativeHttp.get(`/api/me/listening-sessions?itemsPerPage=100&page=${page}`, { connectTimeout: 5000, readTimeout: 10000 }), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 11000))])
    },
    async load() {
      if (this.loading) return
      this.loading = true
      this.serverNote = ''
      try {
        if (!this.$store.state.user.user) {
          this.serverNote = 'Showing this phone only. Connect to your server to see other devices too.'
          return
        }
        const res = await this.fetchPage(0)
        this.server = res.sessions || []
        this.page = 0
        this.hasMore = (res.numPages || 1) > 1
      } catch (error) {
        this.serverNote = this.needsTailscale ? 'Showing this phone only. Turn on Tailscale to see sessions from other devices.' : 'Showing this phone only: the server didn’t answer.'
      } finally {
        this.loading = false
      }
    },
    async loadMore() {
      this.loading = true
      try {
        const res = await this.fetchPage(this.page + 1)
        this.page++
        this.server = [...this.server, ...(res.sessions || [])]
        this.hasMore = this.page + 1 < (res.numPages || 1)
      } catch {
        this.$toast.error('Couldn’t load older sessions')
      } finally {
        this.loading = false
      }
    }
  },
  mounted() {
    this.$tailscale.refresh()
    this.load()
  }
}
</script>
