<template>
  <div>
    <div v-if="!book" class="py-10 text-center text-fg-muted">{{ error || 'Opening…' }}</div>

    <!-- Edit details -->
    <div v-else-if="editing" class="px-5">
      <h2 class="lib-serif text-xl font-semibold">Edit details</h2>
      <p class="text-xs text-fg-muted mt-1">Used for folder names and the metadata file Audiobookshelf reads.</p>
      <label v-for="f in editFields" :key="f[0]" class="block mt-3">
        <span class="block text-sm text-fg-muted mb-1">{{ f[1] }}</span>
        <input v-model="form[f[0]]" class="lib-input" :inputmode="f[0] === 'year' ? 'numeric' : null" autocomplete="off" />
      </label>
      <div class="flex gap-2 mt-4">
        <button type="button" class="lib-btn primary" :disabled="busy" @click="saveEdit">Save</button>
        <button type="button" class="lib-btn quiet" @click="editing = false">Cancel</button>
      </div>
    </div>

    <template v-else>
      <div class="flex gap-4 px-5 pb-4">
        <librarian-cover :book="book" size="lg" />
        <div class="flex-grow min-w-0">
          <h2 class="lib-serif text-xl font-semibold leading-tight">{{ book.title }}</h2>
          <p v-if="book.subtitle" class="lib-serif italic text-fg-muted mt-1">{{ book.subtitle }}</p>
          <button type="button" class="block mt-2 font-medium lib-text-want" @click="goAuthor">{{ book.author.name }}</button>
          <div class="flex flex-wrap gap-x-3 mt-1 text-sm text-fg-muted">
            <span v-if="book.series">{{ book.series }}{{ book.series_num ? ' #' + book.series_num : '' }}</span>
            <span v-if="book.year">First published {{ book.year }}</span>
          </div>
        </div>
      </div>

      <!-- One panel per format -->
      <section v-for="kind in ['audio', 'ebook']" :key="kind" class="mx-3 mb-3 p-3.5 rounded-xl bg-bg">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols text-xl">{{ kind === 'ebook' ? 'menu_book' : 'headphones' }}</span>
          <h3 class="lib-serif font-semibold flex-grow">{{ KIND[kind] }}</h3>
          <span v-if="isSearching(kind)" class="text-sm lib-text-get">Searching…</span>
          <span v-else-if="book[kind + '_status'] === 'snatched'" class="text-sm lib-text-get">Downloading</span>
        </div>
        <librarian-seg wide :options="statusOptions" :value="book[kind + '_status']" @input="setStatus(kind, $event)" />

        <div v-if="activeSnatch(kind)" class="mt-2">
          <div class="flex flex-wrap gap-x-3 text-sm text-fg-muted">
            <span>{{ DL_TEXT[activeSnatch(kind).status] }}</span>
            <span v-if="activeSnatch(kind).message">{{ activeSnatch(kind).message }}</span>
          </div>
          <div class="lib-bar"><i :style="{ width: Math.max(2, activeSnatch(kind).progress || 0) + '%' }" /></div>
        </div>
        <p v-else-if="book[kind + '_status'] === 'wanted' && failedSnatch(kind)" class="text-xs text-fg-muted mt-2">Last attempt failed: {{ failedSnatch(kind).message }}</p>
        <p v-if="book[kind + '_status'] === 'have' && book[kind + '_path']" class="text-xs text-fg-muted mt-2 break-all">{{ pathLabel(book[kind + '_path']) }}</p>

        <div class="flex flex-wrap gap-2 mt-3">
          <button v-if="!['have', 'snatched'].includes(book[kind + '_status'])" type="button" class="lib-btn small" :disabled="busy" @click="searchNow(kind)"><span class="material-symbols">search</span>Search now</button>
          <button type="button" class="lib-btn small" @click="pickRelease(kind)">Pick a release</button>
          <button v-if="kind === 'audio' && book.audio_status === 'have'" type="button" class="lib-btn small" :disabled="findingAbs" @click="openInAbs"><span class="material-symbols">play_circle</span>Play</button>
        </div>

        <!-- Release picker -->
        <div v-if="releases.kind === kind" class="mt-3 border-t border-border">
          <p v-if="releases.loading" class="py-4 text-sm text-fg-muted text-center">Asking your indexers. This can take a little while…</p>
          <template v-else>
            <p v-for="e in releases.errors" :key="e" class="text-xs text-error mt-2">{{ e }}</p>
            <p v-if="!releases.results.length" class="text-xs text-fg-muted mt-2">{{ releases.filtered.length ? 'Nothing passed your search rules. Here’s what was filtered out and why.' : 'Your indexers found nothing for this book.' }}</p>
            <div v-for="(x, i) in shownReleases" :key="i" class="flex gap-3 items-center py-3 border-b border-border">
              <div class="flex-grow min-w-0">
                <p class="text-sm break-words" :class="x._filtered ? 'text-fg-muted' : ''">{{ x.title }}</p>
                <div class="flex flex-wrap gap-x-3 text-xs text-fg-muted mt-0.5">
                  <span>{{ x.size_h }}</span>
                  <span v-if="x.protocol === 'torrent' && x.seeders != null">{{ x.seeders }} seeder{{ x.seeders === 1 ? '' : 's' }}</span>
                  <span v-if="x.protocol === 'usenet'">Usenet</span>
                  <span v-if="x.cache_only">Only if Real-Debrid has it cached</span>
                  <span>{{ x.provider }}</span>
                  <span>{{ x.ratio }}% match</span>
                </div>
                <p v-if="x._filtered" class="text-xs text-error mt-0.5">{{ x.reject }}</p>
              </div>
              <button type="button" class="lib-btn small" :class="x._filtered ? '' : 'primary'" :disabled="busy" @click="grab(kind, x)">Grab</button>
            </div>
            <button v-if="releases.results.length && releases.filtered.length && !releases.showFiltered" type="button" class="lib-btn quiet small mt-2" @click="releases.showFiltered = true">Show {{ releases.filtered.length }} filtered out</button>
          </template>
        </div>
      </section>

      <template v-if="book.description">
        <h3 class="lib-serif font-semibold px-5 pt-4 pb-1">About this book</h3>
        <p class="lib-serif text-fg-muted px-5 whitespace-pre-line leading-relaxed" :class="{ 'lib-clamp': !showDesc }">{{ book.description }}</p>
        <button v-if="!showDesc" type="button" class="lib-btn quiet small ml-2" @click="showDesc = true">Read more</button>
      </template>

      <div v-if="book.ebook_status === 'have' && (book.ebook_files || []).length" class="flex flex-wrap gap-2 px-5 mt-3">
        <button type="button" class="lib-btn" @click="saveEbook"><span class="material-symbols">download</span>Save ebook</button>
        <button v-if="book.email_ready" type="button" class="lib-btn" :disabled="busy" @click="sendToKindle"><span class="material-symbols">send</span>Send to Kindle</button>
      </div>

      <template v-if="(book.events || []).length">
        <h3 class="lib-serif font-semibold px-5 pt-5 pb-1">History</h3>
        <div class="px-5">
          <p v-for="e in book.events" :key="e.id" class="py-2 border-b border-border text-sm text-fg-muted"><span class="opacity-70 mr-2">{{ ago(e.t) }}</span>{{ e.message }}</p>
        </div>
      </template>

      <div class="flex justify-between px-3 mt-3">
        <button type="button" class="lib-btn quiet" @click="startEdit">Edit details</button>
        <button type="button" class="lib-btn danger" :disabled="busy" @click="remove">Remove book</button>
      </div>
    </template>
  </div>
</template>

<script>
import { Dialog } from '@capacitor/dialog'
import { ACTIVE, DL_TEXT, KIND, ago, pathLabel } from '@/plugins/librarian'

export default {
  props: {
    id: { type: Number, required: true }
  },
  data() {
    return {
      KIND,
      DL_TEXT,
      book: null,
      error: '',
      busy: false,
      editing: false,
      form: {},
      showDesc: false,
      findingAbs: false,
      releases: { kind: null, loading: false, results: [], filtered: [], errors: [], showFiltered: false },
      poll: null,
      statusOptions: [
        ['skipped', 'Skip'],
        ['wanted', 'Want'],
        ['have', 'Have'],
        ['ignored', 'Ignore']
      ],
      editFields: [
        ['title', 'Title'],
        ['subtitle', 'Subtitle'],
        ['series', 'Series'],
        ['series_num', 'Number in series'],
        ['year', 'First published']
      ]
    }
  },
  computed: {
    shownReleases() {
      const r = this.releases
      const filtered = r.filtered.map((x) => ({ ...x, _filtered: true }))
      if (!r.results.length) return filtered
      return r.showFiltered ? [...r.results, ...filtered] : r.results
    }
  },
  methods: {
    ago,
    pathLabel,
    async load() {
      try {
        this.book = await this.$librarian.get('/api/books/' + this.id)
        this.schedulePoll()
      } catch (error) {
        this.error = error.message
        if (!this.book) {
          this.$toast.error(error.message)
          this.$emit('close')
        }
      }
    },
    schedulePoll() {
      clearInterval(this.poll)
      const b = this.book
      const active = (b.snatches || []).some((s) => ACTIVE.includes(s.status)) || (b.searching || []).length
      if (active) {
        this.poll = setInterval(() => {
          // Don't redraw underneath an open release list
          if (!document.hidden && !this.releases.kind && !this.editing) this.load()
        }, 3000)
      }
    },
    isSearching(kind) {
      return (this.book.searching || []).includes(kind)
    },
    activeSnatch(kind) {
      return (this.book.snatches || []).find((s) => s.kind === kind && ACTIVE.includes(s.status))
    },
    failedSnatch(kind) {
      return (this.book.snatches || []).find((s) => s.kind === kind && s.status === 'failed')
    },
    changed() {
      this.$librarian.changed({ bookId: this.book.id, book: this.book })
    },
    async setStatus(kind, status) {
      try {
        this.book = await this.$librarian.patch('/api/books/' + this.book.id, { [kind + '_status']: status })
        this.$toast.success(status === 'wanted' ? 'Wanted. It will be searched for shortly.' : 'Saved')
        this.changed()
        this.schedulePoll()
      } catch (error) {
        this.$toast.error(error.message)
      }
    },
    async searchNow(kind) {
      this.busy = true
      try {
        const r = await this.$librarian.post(`/api/books/${this.book.id}/search`, { kind })
        this.$toast.success(r.message + '. Progress shows in Activity.')
        this.changed()
        setTimeout(() => this.load(), 1200)
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    async pickRelease(kind) {
      this.releases = { kind, loading: true, results: [], filtered: [], errors: [], showFiltered: false }
      try {
        const r = await this.$librarian.api(`/api/books/${this.book.id}/search`, { method: 'POST', body: { kind, mode: 'manual' }, timeout: 180000 })
        this.releases = { kind, loading: false, results: r.results || [], filtered: r.filtered || [], errors: r.errors || [], showFiltered: false }
      } catch (error) {
        this.releases = { kind, loading: false, results: [], filtered: [], errors: [error.message], showFiltered: false }
      }
    },
    async grab(kind, x) {
      if (x._filtered) {
        const { value } = await Dialog.confirm({ title: 'Grab anyway?', message: `This release was filtered out:\n${x.reject}` })
        if (!value) return
      }
      this.busy = true
      try {
        const { _filtered, ...release } = x
        await this.$librarian.post(`/api/books/${this.book.id}/grab`, { kind, release })
        this.$toast.success('Sent to your download service')
        this.releases = { kind: null, loading: false, results: [], filtered: [], errors: [], showFiltered: false }
        await this.load()
        this.changed()
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    saveEbook() {
      this.$librarian.openFile(`/opds/file/${this.book.id}/${encodeURIComponent(this.book.ebook_files[0])}`)
    },
    async sendToKindle() {
      this.busy = true
      try {
        const r = await this.$librarian.post(`/api/books/${this.book.id}/email`)
        this.$toast.success(r.message)
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    /** Find the downloaded audiobook in the Audiobookshelf library and open it there */
    async openInAbs() {
      const libraryId = this.$store.state.libraries.currentLibraryId
      if (!libraryId || !this.$store.state.user.user) return this.$toast.error('Connect to your Audiobookshelf server first.')
      this.findingAbs = true
      try {
        const res = await this.$nativeHttp.get(`/api/libraries/${libraryId}/search?q=${encodeURIComponent(this.book.title)}&limit=10`)
        const items = (res?.book || []).map((r) => r.libraryItem)
        const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
        const author = norm(this.book.author.name).split(' ').pop()
        const match = items.find((i) => norm(i.media?.metadata?.authorName).includes(author)) || items[0]
        if (!match) return this.$toast.info('Audiobookshelf hasn’t picked it up yet. It will show up after its next scan.')
        this.$emit('close')
        this.$router.push(`/item/${match.id}`)
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.findingAbs = false
      }
    },
    goAuthor() {
      this.$emit('close')
      this.$router.push('/librarian/author/' + this.book.author.id)
    },
    startEdit() {
      this.form = {}
      this.editFields.forEach(([k]) => (this.form[k] = this.book[k] == null ? '' : String(this.book[k])))
      this.editing = true
    },
    async saveEdit() {
      this.busy = true
      try {
        this.book = await this.$librarian.patch('/api/books/' + this.book.id, { ...this.form })
        this.editing = false
        this.$toast.success('Saved')
        this.changed()
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    async remove() {
      const { value } = await Dialog.confirm({ title: 'Remove book', message: 'Remove this book from Pocket Librarian? Its files stay where they are.' })
      if (!value) return
      this.busy = true
      try {
        await this.$librarian.delete('/api/books/' + this.book.id)
        this.$toast.success('Removed')
        this.changed()
        this.$emit('close')
      } catch (error) {
        this.$toast.error(error.message)
        this.busy = false
      }
    }
  },
  mounted() {
    this.load()
  },
  beforeDestroy() {
    clearInterval(this.poll)
  }
}
</script>
