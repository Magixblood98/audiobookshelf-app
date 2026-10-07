<template>
  <librarian-page title="Discover" tab="discover" @retry="reload">
    <form class="flex gap-2 px-4 pt-4 pb-3" @submit.prevent="search">
      <input ref="input" v-model="q" type="search" enterkeyhint="search" class="lib-input flex-grow" placeholder="Authors, titles or ISBNs" autocomplete="off" @search="!q && search()" />
      <button type="submit" class="lib-btn primary">Search</button>
    </form>

    <!-- Search results -->
    <div v-if="searching || results">
      <p v-if="searching" class="py-8 text-center text-fg-muted">Searching Open Library…</p>
      <template v-else>
        <p v-if="results.error" class="mx-4 p-3 rounded-xl bg-bg-hover/40 border-l-4 border-error text-sm">{{ results.error }}</p>
        <p v-else-if="!results.authors.length && !results.books.length" class="px-5 text-fg-muted">Open Library has nothing for that. Try fewer words or another spelling.</p>
        <template v-if="results.authors.length">
          <h3 class="lib-serif font-semibold px-4 pt-2 pb-2">Authors</h3>
          <div class="border-t border-border">
            <button v-for="x in results.authors.slice(0, 4)" :key="x.ol_id" type="button" class="w-full flex items-center gap-3 px-4 py-3 border-b border-border text-left" @click="openAuthor(x)">
              <librarian-avatar :url="x.photo_url" :name="x.name" />
              <div class="flex-grow min-w-0">
                <p class="lib-serif font-semibold">{{ x.name }}</p>
                <div class="flex flex-wrap gap-x-3 text-sm text-fg-muted">
                  <span v-if="x.top_work">Known for {{ x.top_work }}</span>
                  <span>{{ x.work_count }} work{{ x.work_count === 1 ? '' : 's' }}</span>
                  <span v-if="x.author_id">Following</span>
                </div>
              </div>
              <span class="material-symbols text-fg-muted">chevron_right</span>
            </button>
          </div>
        </template>
        <template v-if="results.books.length">
          <h3 class="lib-serif font-semibold px-4 pt-5 pb-2">Books</h3>
          <div class="border-t border-border">
            <button v-for="(x, i) in results.books" :key="i" type="button" class="w-full flex items-center gap-3 px-4 py-3 border-b border-border text-left" @click="x.book_id ? $librarian.openBook(x.book_id) : $librarian.openAddBook(x)">
              <librarian-cover :book="x" />
              <div class="flex-grow min-w-0">
                <p class="lib-serif">{{ x.title }}</p>
                <div class="flex flex-wrap gap-x-3 text-sm text-fg-muted">
                  <span>{{ x.author_name || 'Unknown author' }}</span>
                  <span v-if="x.year">{{ x.year }}</span>
                  <span v-if="x.book_id">In your library</span>
                </div>
              </div>
              <span class="material-symbols text-fg-muted">chevron_right</span>
            </button>
          </div>
        </template>
        <div class="text-center p-3">
          <button type="button" class="lib-btn quiet" @click="clearSearch">Back to Discover</button>
        </div>
      </template>
    </div>

    <!-- Shelves -->
    <div v-else-if="ready" :key="shelvesKey">
      <div class="flex items-center px-4 pb-2">
        <p class="text-sm text-fg-muted flex-grow">{{ spin ? 'Another draw for today' : 'Fresh picks every day' }}</p>
        <button type="button" class="lib-btn quiet small" @click="shuffle"><span class="material-symbols">shuffle</span>Shuffle</button>
      </div>
      <librarian-disc-shelf title="Picked for you" href="/librarian/discover/picks?kind=foryou" :load="loadForYou" />
      <librarian-disc-shelf title="New releases" :load="loadNewIn" />
      <librarian-disc-shelf title="Trending this week" href="/librarian/discover/trending?period=weekly" :load="loadTrending" />
      <librarian-disc-shelf title="Genre of the day" :load="loadSpotlight" />
      <librarian-disc-shelf title="Hidden gems" href="/librarian/discover/picks?kind=gems" :load="loadGems" />
      <librarian-disc-shelf title="From authors you follow" :load="loadFollowed" />
      <section class="mb-5">
        <h2 class="lib-serif text-lg font-semibold px-4 pt-1.5 pb-3">Browse by genre</h2>
        <div class="flex flex-wrap gap-2 px-4">
          <nuxt-link v-for="(g, i) in genres" :key="g.slug" :to="'/librarian/discover/genre/' + g.slug" class="inline-flex items-center h-10 pl-3 pr-4 rounded-r-xl rounded-l-md border border-border bg-bg-hover/40 text-sm" :style="{ borderLeft: '6px solid ' + cloth[i % cloth.length] }">{{ g.name }}</nuxt-link>
        </div>
      </section>
      <div class="mx-4 p-3 rounded-xl bg-bg-hover/40 border-l-4 text-sm" style="border-left-color: var(--lib-get)">
        Already keep a list somewhere?
        <nuxt-link to="/librarian/settings/lists" class="font-semibold lib-text-want">Import a CSV or follow a Goodreads shelf</nuxt-link>.
      </div>
    </div>
  </librarian-page>
</template>

<script>
import { Preferences } from '@capacitor/preferences'
import { CLOTH, joinList } from '@/plugins/librarian'

// Discover picks change every day. Shuffle draws another set for today; it resets at midnight.
const today = () => new Date().toLocaleDateString('en-CA')
let lastQuery = ''

export default {
  data() {
    return { q: lastQuery, searching: false, results: null, spin: 0, ready: false, genres: [], cloth: CLOTH, shelvesKey: 0 }
  },
  computed: {
    query() {
      return `spin=${this.spin}&limit=20&track=1`
    }
  },
  methods: {
    async search() {
      const q = this.q.trim()
      lastQuery = q
      if (q.length < 2) return this.clearSearch()
      this.$refs.input && this.$refs.input.blur()
      this.searching = true
      const enc = encodeURIComponent(q)
      const [au, bk] = await Promise.allSettled([this.$librarian.get('/api/lookup/authors?q=' + enc), this.$librarian.get('/api/lookup/books?q=' + enc)])
      if (lastQuery !== q) return
      const authors = au.status === 'fulfilled' ? au.value.results : []
      const books = bk.status === 'fulfilled' ? bk.value.results : []
      const error = au.status === 'rejected' && bk.status === 'rejected' ? bk.reason.message : ''
      this.results = { authors, books, error }
      this.searching = false
    },
    clearSearch() {
      this.q = ''
      lastQuery = ''
      this.results = null
      this.searching = false
    },
    openAuthor(x) {
      if (x.author_id) this.$router.push('/librarian/author/' + x.author_id)
      else this.$librarian.openAddAuthor(x)
    },
    async readSpin() {
      try {
        const { value } = await Preferences.get({ key: 'librarianDiscSpin' })
        const st = value ? JSON.parse(value) : {}
        return st.day === today() ? st.spin : 0
      } catch {
        return 0
      }
    },
    async shuffle() {
      this.spin = (this.spin + 1) % 1000
      await Preferences.set({ key: 'librarianDiscSpin', value: JSON.stringify({ day: today(), spin: this.spin }) })
      this.shelvesKey++
    },
    reload() {
      this.shelvesKey++
      this.loadGenres()
    },
    async loadGenres() {
      try {
        this.genres = (await this.$librarian.get('/api/discover/genres')).genres
      } catch {
        // the page frame shows connection problems
      }
    },
    async loadForYou() {
      const d = await this.$librarian.get('/api/discover/foryou?' + this.query)
      return { books: d.books, sub: d.because.length ? 'Today: ' + joinList(d.because) : '' }
    },
    async loadNewIn() {
      const d = await this.$librarian.get('/api/discover/newin?' + this.query)
      return { books: d.books, title: 'New in ' + d.name.toLowerCase(), href: `/librarian/discover/genre/${d.slug}?mode=new`, sub: 'Popular from the last couple of years' }
    },
    async loadTrending() {
      const d = await this.$librarian.get('/api/discover/trending?period=weekly&limit=20')
      return { books: d.books, sub: 'Most read on Open Library over the last seven days' }
    },
    async loadSpotlight() {
      const d = await this.$librarian.get('/api/discover/spotlight?' + this.query)
      return { books: d.books, title: 'Try something different: ' + d.name.toLowerCase(), href: '/librarian/discover/genre/' + d.slug, sub: 'Outside your usual shelves, a new genre each day' }
    },
    async loadGems() {
      const d = await this.$librarian.get('/api/discover/gems?' + this.query)
      return { books: d.books, sub: d.because.length ? 'Lesser-known books in ' + joinList(d.because) : '' }
    },
    async loadFollowed() {
      const d = await this.$librarian.get('/api/discover/followed?' + this.query)
      return { books: d.books.map((b) => ({ ...b, book_id: b.id })), sub: 'Books you haven’t wanted yet' }
    }
  },
  async mounted() {
    this.spin = await this.readSpin()
    this.ready = true
    this.loadGenres()
    if (this.q) this.search()
  }
}
</script>
