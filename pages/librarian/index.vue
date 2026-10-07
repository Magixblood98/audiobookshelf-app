<template>
  <librarian-page title="Library" tab="library" @retry="load">
    <template v-if="status">
      <div v-for="w in status.warnings || []" :key="w.id" class="mx-4 mt-3 p-3 rounded-xl bg-bg-hover/40 border-l-4 lib-border-want text-sm">
        {{ w.text }}
        <nuxt-link v-if="w.href" :to="fixLink(w.href)" class="font-semibold lib-text-want ml-1">Fix it</nuxt-link>
      </div>

      <section v-if="!setupDone" class="mx-4 mt-4 p-4 rounded-2xl bg-bg-hover/40">
        <h2 class="lib-serif text-lg font-semibold">Three steps to your first book</h2>
        <p class="text-sm text-fg-muted mt-1">Pocket Librarian asks your indexers for releases, hands the best one to your download service, then files the book in your library folder.</p>
        <ol class="mt-3">
          <li v-for="(s, i) in setupSteps" :key="i" class="flex items-center gap-3 py-2.5 border-t border-border" :class="s.done ? 'text-fg-muted' : ''">
            <span class="flex-none w-7 h-7 rounded-full grid place-items-center text-sm border border-border" :class="s.done ? 'lib-bg-want' : ''">{{ s.done ? '✓' : i + 1 }}</span>
            <span class="flex-grow">{{ s.text }}</span>
            <nuxt-link v-if="!s.done" :to="s.to" class="lib-btn small">{{ s.btn }}</nuxt-link>
          </li>
        </ol>
      </section>

      <div v-if="status.counts.books" class="px-4 pt-4 pb-3">
        <librarian-seg :options="[['authors', 'Authors'], ['books', 'Books']]" :value="tab" @input="setTab" />
      </div>
    </template>

    <!-- Authors -->
    <template v-if="tab === 'authors'">
      <p v-if="loading && !authors" class="py-8 text-center text-fg-muted">Loading…</p>
      <div v-else-if="authors && !authors.length" class="px-8 py-12 text-center">
        <h2 class="lib-serif text-xl font-semibold">Your shelves are empty</h2>
        <p class="text-fg-muted mt-2">Follow an author and their books appear here, ready to want as ebooks or audiobooks.</p>
        <nuxt-link to="/librarian/discover" class="lib-btn primary mt-5">Find an author</nuxt-link>
      </div>
      <template v-else-if="authors">
        <div v-if="authors.length > 7" class="px-4 pb-3">
          <input v-model="filter" type="search" class="lib-input" placeholder="Filter authors" autocomplete="off" />
        </div>
        <div class="border-t border-border">
          <nuxt-link v-for="a in filteredAuthors" :key="a.id" :to="'/librarian/author/' + a.id" class="flex items-center gap-3.5 px-4 py-3 border-b border-border">
            <librarian-avatar :url="a.photo_url" :name="a.name" />
            <div class="flex-grow min-w-0">
              <p class="lib-serif font-semibold">{{ a.name }}</p>
              <librarian-spine-bar v-if="a.total" :code="a.spine" />
              <p class="text-sm text-fg-muted mt-0.5">{{ authorSummary(a) }}</p>
            </div>
            <span class="material-symbols text-fg-muted">chevron_right</span>
          </nuxt-link>
        </div>
      </template>
    </template>

    <!-- Books -->
    <template v-else>
      <div class="px-4 pb-3">
        <librarian-seg :options="bookFilters" :value="bookFilter" @input="setBookFilter" />
      </div>
      <div v-if="books && !books.length" class="px-8 py-12 text-center">
        <h2 class="lib-serif text-xl font-semibold">{{ emptyText[bookFilter][0] }}</h2>
        <p class="text-fg-muted mt-2">{{ emptyText[bookFilter][1] }}</p>
        <nuxt-link to="/librarian/discover" class="lib-btn primary mt-5">Discover books</nuxt-link>
      </div>
      <div v-else-if="books" class="border-t border-border">
        <librarian-book-row v-for="b in books" :key="b.id" :book="b" show-author />
      </div>
      <div class="text-center p-3">
        <button v-if="books && books.length < booksTotal" type="button" class="lib-btn quiet" :disabled="loading" @click="loadBooks(true)">Show more ({{ booksTotal - books.length }} left)</button>
      </div>
    </template>
  </librarian-page>
</template>

<script>
export default {
  data() {
    return {
      tab: 'authors',
      authors: null,
      filter: '',
      books: null,
      booksTotal: 0,
      bookFilter: 'have',
      loading: false,
      poll: null,
      bookFilters: [
        ['have', 'In library'],
        ['wanted', 'Wanted'],
        ['snatched', 'Downloading'],
        ['tracked', 'Everything']
      ],
      emptyText: {
        have: ['Nothing in your library yet', 'Books land here once they’ve downloaded, or when a folder scan finds them.'],
        wanted: ['Nothing wanted', 'Tap Want on a book to have it searched for.'],
        snatched: ['Nothing downloading', 'Downloads in progress show up here.'],
        tracked: ['No books yet', 'Follow an author or add a single book.']
      }
    }
  },
  computed: {
    status() {
      return this.$store.state.librarian.status
    },
    setupSteps() {
      const s = this.status?.setup || {}
      return [
        { done: s.indexer, text: 'Connect Prowlarr or another indexer', btn: 'Add indexer', to: '/librarian/settings/indexers' },
        { done: s.client, text: 'Choose how downloads happen', btn: 'Set up', to: '/librarian/settings/downloads' },
        { done: s.author, text: 'Follow an author', btn: 'Find one', to: '/librarian/discover' }
      ]
    },
    setupDone() {
      return this.setupSteps.every((s) => s.done)
    },
    filteredAuthors() {
      const q = this.filter.trim().toLowerCase()
      return (this.authors || []).filter((a) => !q || a.name.toLowerCase().includes(q))
    }
  },
  methods: {
    fixLink(href) {
      // Pocket Librarian links look like #/settings/library
      return '/librarian' + href.replace(/^#/, '')
    },
    authorSummary(a) {
      if (a.refreshing && !a.total) return 'Fetching books from Open Library…'
      const parts = [`${a.have} of ${a.total} in library`]
      if (a.wanted) parts.push(`${a.wanted} wanted`)
      if (a.active) parts.push(`${a.active} downloading`)
      if (!a.followed) parts.push('not following')
      return parts.join(', ')
    },
    setTab(t) {
      this.tab = t
      this.$router.replace({ query: t === 'books' ? { tab: 'books' } : {} })
      this.load()
    },
    setBookFilter(f) {
      this.bookFilter = f
      this.loadBooks()
    },
    async load() {
      if (this.tab === 'books') return this.loadBooks()
      this.loading = true
      try {
        const d = await this.$librarian.get('/api/authors')
        this.authors = d.authors
        clearInterval(this.poll)
        if (this.authors.some((a) => a.refreshing)) this.poll = setInterval(() => !document.hidden && this.load(), 3000)
      } catch (error) {
        if (!error.offline && !error.login) this.$toast.error(error.message)
      } finally {
        this.loading = false
      }
    },
    async loadBooks(more = false) {
      this.loading = true
      try {
        const offset = more ? this.books.length : 0
        const f = this.bookFilter
        const d = await this.$librarian.get(`/api/books?status=${f}&sort=${f === 'have' ? 'recent' : 'title'}&limit=60&offset=${offset}`)
        this.books = more ? [...this.books, ...d.books] : d.books
        this.booksTotal = d.total
      } catch (error) {
        if (!error.offline && !error.login) this.$toast.error(error.message)
      } finally {
        this.loading = false
      }
    },
    onChanged() {
      this.load()
    }
  },
  mounted() {
    if (this.$route.query.tab === 'books') this.tab = 'books'
    this.load()
    this.$eventBus.$on('librarian-changed', this.onChanged)
  },
  beforeDestroy() {
    clearInterval(this.poll)
    this.$eventBus.$off('librarian-changed', this.onChanged)
  }
}
</script>
