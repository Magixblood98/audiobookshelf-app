<template>
  <librarian-page :title="gems ? 'Hidden gems' : 'Picked for you'" tab="discover" @retry="load">
    <p v-if="books === null" class="py-8 text-center text-fg-muted">Loading…</p>
    <div v-else-if="!books.length" class="px-8 py-12 text-center">
      <h2 class="lib-serif text-xl font-semibold">Nothing picked yet</h2>
      <p class="text-fg-muted mt-2">Picks come from the subjects of books you have or want. Want a few books and check back.</p>
      <nuxt-link to="/librarian/discover" class="lib-btn primary mt-5">Browse genres</nuxt-link>
    </div>
    <template v-else>
      <p class="text-sm text-fg-muted px-4 pt-4 pb-4">{{ gems ? 'Lesser-known books in ' : 'Today’s picks from ' }}{{ joinList(because) }}. Shuffle on Discover for another set.</p>
      <div class="lib-grid">
        <librarian-disc-item v-for="(b, i) in books" :key="i" :book="b" grid />
      </div>
    </template>
  </librarian-page>
</template>

<script>
import { Preferences } from '@capacitor/preferences'
import { joinList } from '@/plugins/librarian'

export default {
  data() {
    return { books: null, because: [] }
  },
  computed: {
    gems() {
      return this.$route.query.kind === 'gems'
    }
  },
  methods: {
    joinList,
    async load() {
      let spin = 0
      try {
        const { value } = await Preferences.get({ key: 'librarianDiscSpin' })
        const st = value ? JSON.parse(value) : {}
        if (st.day === new Date().toLocaleDateString('en-CA')) spin = st.spin
      } catch {
        // first visit today
      }
      try {
        const d = await this.$librarian.disc(`/api/discover/${this.gems ? 'gems' : 'foryou'}?spin=${spin}&limit=60`)
        this.books = d.books
        this.because = d.because || []
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
