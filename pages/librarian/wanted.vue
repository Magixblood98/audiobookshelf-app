<template>
  <librarian-page title="Wanted" tab="wanted" @retry="load">
    <div class="flex items-center justify-between flex-wrap gap-2 px-4 pt-4 pb-3">
      <librarian-seg :options="kindOptions" :value="kind" @input="setKind" />
      <button type="button" class="lib-btn small" :disabled="busy" @click="searchAll"><span class="material-symbols">search</span>Search all</button>
    </div>
    <p v-if="books === null" class="py-8 text-center text-fg-muted">Loading…</p>
    <div v-else-if="!books.length" class="px-8 py-12 text-center">
      <h2 class="lib-serif text-xl font-semibold">No {{ kind === 'audio' ? 'audiobooks' : 'ebooks' }} wanted</h2>
      <p class="text-fg-muted mt-2">Tap Want on any book, or have followed authors’ new releases wanted automatically.</p>
      <nuxt-link to="/librarian" class="lib-btn primary mt-5">Go to your library</nuxt-link>
    </div>
    <div v-else class="border-t border-border">
      <librarian-book-row v-for="b in books" :key="b.id" :book="b" show-author :extra="b[kind + '_last_search'] ? 'Searched ' + ago(b[kind + '_last_search']) : 'Not searched yet'" />
    </div>
  </librarian-page>
</template>

<script>
import { ago } from '@/plugins/librarian'

export default {
  data() {
    return { kind: 'audio', books: null, busy: false }
  },
  computed: {
    counts() {
      return this.$store.state.librarian.status?.counts || {}
    },
    kindOptions() {
      return [
        ['audio', 'Audiobooks', this.counts.wanted_audio],
        ['ebook', 'Ebooks', this.counts.wanted_ebook]
      ]
    }
  },
  methods: {
    ago,
    setKind(k) {
      this.kind = k
      this.books = null
      this.load()
    },
    async load() {
      try {
        const d = await this.$librarian.get(`/api/books?status=wanted&kind=${this.kind}&sort=searched&limit=300`)
        this.books = d.books
      } catch (error) {
        if (!error.offline && !error.login) this.$toast.error(error.message)
      }
    },
    async searchAll() {
      this.busy = true
      try {
        const r = await this.$librarian.post('/api/jobs/search/run')
        this.$toast.success(r.started ? 'Searching for everything wanted' : 'A search is already running')
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    onChanged() {
      this.load()
    }
  },
  mounted() {
    if (this.$route.query.kind === 'ebook') this.kind = 'ebook'
    this.load()
    this.$eventBus.$on('librarian-changed', this.onChanged)
  },
  beforeDestroy() {
    this.$eventBus.$off('librarian-changed', this.onChanged)
  }
}
</script>
