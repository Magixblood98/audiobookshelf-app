<template>
  <librarian-page title="Trending" tab="discover" @retry="load">
    <div class="px-4 pt-4 pb-4">
      <librarian-seg :options="periods" :value="period" @input="setPeriod" />
    </div>
    <p v-if="books === null" class="py-8 text-center text-fg-muted">Loading…</p>
    <div v-else-if="!books.length" class="px-8 py-12 text-center">
      <h2 class="lib-serif text-xl font-semibold">Nothing trending</h2>
      <p class="text-fg-muted mt-2">Open Library has no trending list for this period right now.</p>
    </div>
    <div v-else class="lib-grid">
      <librarian-disc-item v-for="(b, i) in books" :key="i" :book="b" grid />
    </div>
  </librarian-page>
</template>

<script>
const PERIODS = [
  ['daily', 'Today'],
  ['weekly', 'This week'],
  ['monthly', 'This month'],
  ['yearly', 'This year'],
  ['forever', 'All time']
]

export default {
  data() {
    const p = this.$route.query.period
    return { periods: PERIODS, period: PERIODS.some((x) => x[0] === p) ? p : 'weekly', books: null }
  },
  methods: {
    setPeriod(p) {
      this.period = p
      this.books = null
      this.load()
    },
    async load() {
      try {
        this.books = (await this.$librarian.get(`/api/discover/trending?period=${this.period}&limit=60`)).books
      } catch (error) {
        if (!error.offline && !error.login) this.$toast.error(error.message)
      }
    }
  },
  mounted() {
    this.load()
  }
}
</script>
