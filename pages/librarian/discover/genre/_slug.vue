<template>
  <librarian-page :title="name" tab="discover" @retry="reset">
    <div class="px-4 pt-4 pb-4">
      <librarian-seg :options="[['popular', 'Most read'], ['new', 'New releases']]" :value="mode" @input="setMode" />
    </div>
    <p v-if="books === null" class="py-8 text-center text-fg-muted">Loading…</p>
    <div v-else-if="!books.length" class="px-8 py-12 text-center">
      <h2 class="lib-serif text-xl font-semibold">Nothing here yet</h2>
      <p class="text-fg-muted mt-2">{{ mode === 'new' ? 'No widely read books from the last couple of years under this subject. Try Most read.' : 'Open Library has no books under this subject.' }}</p>
    </div>
    <div v-else class="lib-grid">
      <librarian-disc-item v-for="(b, i) in books" :key="i" :book="b" grid />
    </div>
    <div class="text-center p-3">
      <button v-if="more" type="button" class="lib-btn quiet" :disabled="loading" @click="load">Show more</button>
    </div>
  </librarian-page>
</template>

<script>
export default {
  data() {
    return { mode: this.$route.query.mode === 'new' ? 'new' : 'popular', books: null, name: 'Discover', loading: false, more: false }
  },
  methods: {
    setMode(m) {
      this.mode = m
      this.reset()
    },
    reset() {
      this.books = null
      this.load()
    },
    async load() {
      this.loading = true
      try {
        const offset = this.books ? this.books.length : 0
        const d = await this.$librarian.get(`/api/discover/genre/${encodeURIComponent(this.$route.params.slug)}?mode=${this.mode}&offset=${offset}`)
        this.name = d.name
        this.books = [...(this.books || []), ...d.books]
        this.more = d.books.length >= 40
      } catch (error) {
        if (!error.offline && !error.login) this.$toast.error(error.message)
      } finally {
        this.loading = false
      }
    }
  },
  mounted() {
    this.load()
  }
}
</script>
