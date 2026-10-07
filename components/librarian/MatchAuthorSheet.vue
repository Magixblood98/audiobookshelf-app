<template>
  <div>
    <div class="px-5">
      <h2 class="lib-serif text-xl font-semibold">Which one is it?</h2>
      <p class="text-xs text-fg-muted mt-1">Linking fills in the rest of this author’s books and keeps them up to date.</p>
    </div>
    <p v-if="loading" class="py-6 text-center text-fg-muted">Searching Open Library…</p>
    <p v-else-if="error" class="px-5 py-4 text-error text-sm">{{ error }}</p>
    <p v-else-if="!results.length" class="px-5 py-4 text-fg-muted">Open Library has no author by that name.</p>
    <button v-for="x in results" :key="x.ol_id" type="button" class="w-full flex items-center gap-3 px-4 py-3 border-b border-border text-left" :disabled="busy" @click="link(x)">
      <librarian-avatar :url="x.photo_url" :name="x.name" />
      <div class="flex-grow min-w-0">
        <p class="lib-serif font-semibold">{{ x.name }}</p>
        <div class="flex flex-wrap gap-x-3 text-sm text-fg-muted">
          <span v-if="x.top_work">Known for {{ x.top_work }}</span>
          <span>{{ x.work_count }} works</span>
        </div>
      </div>
    </button>
  </div>
</template>

<script>
export default {
  props: {
    author: { type: Object, required: true }
  },
  data() {
    return { loading: true, error: '', results: [], busy: false }
  },
  methods: {
    async link(x) {
      this.busy = true
      try {
        const r = await this.$librarian.post(`/api/authors/${this.author.id}/link`, { ol_id: x.ol_id })
        this.$toast.success('Linked to Open Library')
        this.$librarian.changed({ authorId: r.id })
        this.$emit('close')
        this.$router.replace('/librarian/author/' + r.id)
      } catch (error) {
        this.$toast.error(error.message)
        this.busy = false
      }
    }
  },
  async mounted() {
    try {
      const d = await this.$librarian.get('/api/lookup/authors?q=' + encodeURIComponent(this.author.name))
      this.results = d.results
    } catch (error) {
      this.error = error.message
    } finally {
      this.loading = false
    }
  }
}
</script>
