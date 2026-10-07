<template>
  <librarian-page title="Activity" tab="activity" @retry="load">
    <div class="px-4 pt-4 pb-3">
      <librarian-seg :options="tabs" :value="tab" @input="setTab" />
    </div>

    <!-- Downloads -->
    <template v-if="tab === 'downloads'">
      <p v-if="downloads === null" class="py-8 text-center text-fg-muted">Loading…</p>
      <div v-else-if="!downloads.length" class="px-8 py-12 text-center">
        <h2 class="lib-serif text-xl font-semibold">Nothing downloading</h2>
        <p class="text-fg-muted mt-2">Wanted books are searched for on a schedule. To start one now, open a book and tap Search now.</p>
        <nuxt-link to="/librarian/wanted" class="lib-btn primary mt-5">See what’s wanted</nuxt-link>
      </div>
      <div v-else class="border-t border-border">
        <div v-for="d in downloads" :key="d.id" class="px-4 py-3 border-b border-border">
          <p class="lib-serif" :class="d.book_id ? 'underline decoration-dotted' : ''" @click="d.book_id && $librarian.openBook(d.book_id)">{{ d.book_title || d.title }}</p>
          <div class="flex flex-wrap gap-x-3 text-sm text-fg-muted mt-0.5">
            <span>{{ KIND[d.kind] }}</span>
            <span>{{ d.client_label }}</span>
            <span v-if="d.size_h">{{ d.size_h }}</span>
            <span>{{ ago(d.updated) }}</span>
          </div>
          <p class="text-xs text-fg-muted opacity-75 mt-1 break-words">{{ d.title }}</p>
          <div v-if="isActive(d)" class="lib-bar"><i :style="{ width: Math.max(2, d.progress || 0) + '%' }" /></div>
          <p class="text-sm mt-1.5" :class="dlColor(d.status)">
            {{ (DL_TEXT[d.status] || d.status) + (isActive(d) && d.progress ? ` (${Math.round(d.progress)}%)` : '') }}
            <span v-if="d.message" class="block text-xs text-fg-muted mt-0.5 break-words">{{ d.message }}</span>
          </p>
          <div class="flex flex-wrap gap-2 mt-2">
            <button v-if="d.status === 'failed' && d.book_status !== 'have'" type="button" class="lib-btn small" :disabled="busy" @click="call(`/api/downloads/${d.id}/retry`, 'POST', 'Trying again')">Try again</button>
            <button v-if="isActive(d)" type="button" class="lib-btn small quiet" :disabled="busy" @click="giveUp(d)">Give up</button>
            <button v-else type="button" class="lib-btn small quiet" :disabled="busy" @click="call(`/api/downloads/${d.id}`, 'DELETE', 'Cleared from the list')">Clear</button>
          </div>
        </div>
      </div>
    </template>

    <!-- History -->
    <template v-else-if="tab === 'history'">
      <p v-if="events === null" class="py-8 text-center text-fg-muted">Loading…</p>
      <div v-else-if="!events.length" class="px-8 py-12 text-center">
        <h2 class="lib-serif text-xl font-semibold">No history yet</h2>
        <p class="text-fg-muted mt-2">Searches, downloads and new books show up here as they happen.</p>
      </div>
      <div v-else class="border-t border-border">
        <div v-for="e in events" :key="e.id" class="flex items-center gap-3 px-4 py-3 border-b border-border" @click="e.book_id && $librarian.openBook(e.book_id)">
          <span class="flex-none w-9 h-9 rounded-full grid place-items-center bg-bg-hover/50" :style="{ color: evColor(e.type) }"><span class="material-symbols text-lg">{{ EV_ICON[e.type] || 'circle' }}</span></span>
          <div class="flex-grow min-w-0">
            <p class="text-sm">{{ e.message }}</p>
            <p class="text-xs text-fg-muted">{{ ago(e.t) }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- Jobs -->
    <template v-else-if="tab === 'jobs'">
      <p v-if="jobs === null" class="py-8 text-center text-fg-muted">Loading…</p>
      <div v-else class="border-t border-border">
        <div v-for="j in jobs" :key="j.name" class="flex items-center gap-3 px-4 py-3 border-b border-border">
          <div class="flex-grow min-w-0">
            <p class="lib-serif">{{ j.label }}</p>
            <div class="flex flex-wrap gap-x-3 text-sm text-fg-muted">
              <span>{{ j.manual ? 'Runs when you start it' : every(j.interval) }}</span>
              <span v-if="j.next_run && !j.running">Next {{ until(j.next_run) }}</span>
            </div>
            <p class="text-xs text-fg-muted mt-1">{{ j.running ? 'Running now…' : j.last_run ? `Last ran ${ago(j.last_run)}: ${j.last_result}` : 'Hasn’t run yet' }}</p>
          </div>
          <button v-if="!j.manual" type="button" class="lib-btn small" :disabled="j.running || busy" @click="runJob(j)">Run now</button>
        </div>
      </div>
    </template>

    <!-- Blocklist: releases that failed and won't be grabbed again -->
    <template v-else-if="tab === 'blocklist'">
      <p class="text-sm text-fg-muted px-4 pb-3">Releases that failed are skipped in future searches. Remove one to let it be tried again.</p>
      <p v-if="blocklist === null" class="py-8 text-center text-fg-muted">Loading…</p>
      <div v-else-if="!blocklist.length" class="px-8 py-10 text-center text-fg-muted">Nothing blocklisted.</div>
      <template v-else>
        <div class="border-t border-border">
          <div v-for="b in blocklist" :key="b.id" class="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div class="flex-grow min-w-0">
              <p class="lib-serif" @click="b.book_id && $librarian.openBook(b.book_id)">{{ b.book_title || 'Removed book' }}<span class="text-fg-muted text-sm"> · {{ KIND[b.kind] }}</span></p>
              <p class="text-xs text-fg-muted break-words mt-0.5">{{ b.title }}</p>
              <p class="text-xs text-error mt-0.5">{{ b.reason }} · {{ ago(b.added) }}</p>
            </div>
            <button type="button" class="lib-btn small quiet" :disabled="busy" @click="unblock(b)">Remove</button>
          </div>
        </div>
        <div class="px-4 pt-3"><button type="button" class="lib-btn small danger" :disabled="busy" @click="clearBlocklist">Clear the blocklist</button></div>
      </template>
    </template>

    <!-- Log -->
    <template v-else>
      <div class="flex gap-2 px-4 pb-2">
        <button type="button" class="lib-btn small" @click="load"><span class="material-symbols">refresh</span>Refresh</button>
        <button type="button" class="lib-btn small" @click="copyLog"><span class="material-symbols">content_copy</span>Copy</button>
      </div>
      <pre class="px-4 pb-5 text-xs leading-relaxed whitespace-pre-wrap break-words text-fg-muted font-mono"><div v-for="(l, i) in logLines" :key="i" :style="{ color: l.level === 'ERROR' ? '#ff5252' : l.level === 'WARNING' ? 'var(--lib-want)' : null }">{{ fmtTime(l.t) }}  {{ l.msg }}</div></pre>
    </template>
  </librarian-page>
</template>

<script>
import { Clipboard } from '@capacitor/clipboard'
import { Dialog } from '@capacitor/dialog'
import { ACTIVE, DL_TEXT, KIND, ago, every, until } from '@/plugins/librarian'

const EV_ICON = { snatched: 'download', downloaded: 'check', failed: 'error', missing: 'error', wanted: 'bookmark', new_book: 'notifications', author: 'person', book: 'menu_book', found: 'shelves', kindle: 'send', wishlist: 'bookmark' }

export default {
  data() {
    return {
      KIND,
      DL_TEXT,
      EV_ICON,
      tab: 'downloads',
      tabs: [
        ['downloads', 'Downloads'],
        ['history', 'History'],
        ['jobs', 'Jobs'],
        ['blocklist', 'Blocklist'],
        ['log', 'Log']
      ],
      blocklist: null,
      downloads: null,
      events: null,
      jobs: null,
      logLines: [],
      busy: false,
      poll: null
    }
  },
  methods: {
    ago,
    every,
    until,
    isActive(d) {
      return ACTIVE.includes(d.status)
    },
    dlColor(status) {
      return { failed: 'text-error', done: 'text-success', downloading: 'lib-text-get', fetching: 'lib-text-get' }[status] || 'text-fg-muted'
    },
    evColor(type) {
      return { downloaded: '#4CAF50', failed: '#FF5252', missing: '#FF5252', snatched: 'var(--lib-get)', new_book: 'var(--lib-want)', wanted: 'var(--lib-want)' }[type] || null
    },
    fmtTime(t) {
      return new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    },
    setTab(t) {
      this.tab = t
      this.$router.replace({ query: { tab: t } })
      this.load()
    },
    async load() {
      clearInterval(this.poll)
      const tab = this.tab
      try {
        if (tab === 'downloads') {
          this.downloads = (await this.$librarian.get('/api/downloads')).downloads
          this.poll = setInterval(() => !document.hidden && this.refreshQuiet(), 3000)
        } else if (tab === 'history') {
          this.events = (await this.$librarian.get('/api/events?limit=150')).events
        } else if (tab === 'jobs') {
          this.jobs = (await this.$librarian.get('/api/jobs')).jobs
          this.poll = setInterval(() => !document.hidden && this.refreshQuiet(), 4000)
        } else if (tab === 'blocklist') {
          this.blocklist = (await this.$librarian.get('/api/blocklist')).items
        } else {
          this.logLines = (await this.$librarian.get('/api/logs')).lines.slice(-300).reverse()
        }
      } catch (error) {
        if (!error.offline && !error.login) this.$toast.error(error.message)
      }
    },
    async refreshQuiet() {
      try {
        if (this.tab === 'downloads') this.downloads = (await this.$librarian.get('/api/downloads')).downloads
        else if (this.tab === 'jobs') this.jobs = (await this.$librarian.get('/api/jobs')).jobs
      } catch {
        // the page frame shows connection problems
      }
    },
    async call(path, method, msg) {
      this.busy = true
      try {
        await this.$librarian.api(path, { method })
        this.$toast.success(msg)
        await this.refreshQuiet()
        this.$librarian.changed({ downloads: true })
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    async giveUp(d) {
      const { value } = await Dialog.confirm({ title: 'Give up', message: 'Give up on this download? The release is blocklisted and another one is searched for.' })
      if (value) this.call(`/api/downloads/${d.id}/fail`, 'POST', 'Marked as failed')
    },
    async runJob(j) {
      this.busy = true
      try {
        const r = await this.$librarian.post(`/api/jobs/${j.name}/run`)
        this.$toast.success(r.message)
        setTimeout(() => this.refreshQuiet(), 700)
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    async unblock(b) {
      this.busy = true
      try {
        await this.$librarian.delete(`/api/blocklist/${b.id}`)
        this.blocklist = this.blocklist.filter((x) => x.id !== b.id)
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    async clearBlocklist() {
      const { value } = await Dialog.confirm({ title: 'Clear the blocklist', message: 'Let every blocklisted release be tried again?' })
      if (!value) return
      this.busy = true
      try {
        await this.$librarian.delete('/api/blocklist')
        this.blocklist = []
        this.$toast.success('Blocklist cleared')
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    async copyLog() {
      await Clipboard.write({ string: this.logLines.map((l) => `${this.fmtTime(l.t)}  ${l.msg}`).join('\n') })
      this.$toast.success('Log copied')
    }
  },
  mounted() {
    if (this.tabs.some((t) => t[0] === this.$route.query.tab)) this.tab = this.$route.query.tab
    this.load()
  },
  beforeDestroy() {
    clearInterval(this.poll)
  }
}
</script>
