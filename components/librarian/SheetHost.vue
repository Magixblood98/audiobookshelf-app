<template>
  <div v-if="sheet" class="fixed inset-0 z-50" @click.self="close">
    <div class="absolute inset-0 bg-black transition-opacity duration-200" :class="open ? 'bg-opacity-60' : 'bg-opacity-0'" @click="close" />
    <div class="absolute left-0 right-0 bottom-0 bg-bg-hover/0 transition-transform duration-300" :class="open ? 'translate-y-0' : 'translate-y-full'" style="max-height: 92vh">
      <div ref="body" class="bg-primary rounded-t-2xl overflow-y-auto pb-8" style="max-height: 92vh; overscroll-behavior: contain">
        <div class="sticky top-0 z-10 flex justify-center pt-2 pb-3 bg-primary rounded-t-2xl">
          <div class="w-10 h-1 rounded bg-fg-muted/40" />
        </div>
        <librarian-book-sheet v-if="sheet.type === 'book'" :key="key" :id="sheet.id" @close="close" />
        <librarian-add-book-sheet v-else-if="sheet.type === 'addBook'" :key="key" :book="sheet.book" @close="close" />
        <librarian-add-author-sheet v-else-if="sheet.type === 'addAuthor'" :key="key" :author="sheet.author" @close="close" />
        <librarian-author-menu-sheet v-else-if="sheet.type === 'authorMenu'" :key="key" :author="sheet.author" :book-count="sheet.bookCount || 0" @close="close" />
        <librarian-match-author-sheet v-else-if="sheet.type === 'matchAuthor'" :key="key" :author="sheet.author" @close="close" />
        <librarian-provider-sheet v-else-if="sheet.type === 'provider'" :key="key" :provider="sheet.provider" :index="sheet.index" :providers="sheet.providers" @close="close" />
        <librarian-wishlist-sheet v-else-if="sheet.type === 'wishlist'" :key="key" :wishlist="sheet.wishlist" :index="sheet.index" :wishlists="sheet.wishlists" @close="close" />
      </div>
    </div>
  </div>
</template>

<script>
/** Hosts every Librarian bottom sheet; open one with this.$librarian.openSheet({ type, ... }) */
export default {
  data() {
    return { sheet: null, open: false, key: 0 }
  },
  watch: {
    $route() {
      if (this.sheet) this.close()
    }
  },
  methods: {
    show(payload) {
      this.key++
      this.sheet = payload
      this.$store.commit('globals/setIsModalOpen', true)
      this.$nextTick(() => {
        if (this.$refs.body) this.$refs.body.scrollTop = 0
        requestAnimationFrame(() => (this.open = true))
      })
    },
    close() {
      if (!this.sheet) return
      this.open = false
      this.$store.commit('globals/setIsModalOpen', false)
      const key = this.key
      setTimeout(() => {
        if (this.key === key) this.sheet = null
      }, 280)
    }
  },
  mounted() {
    this.$eventBus.$on('librarian-sheet', this.show)
    this.$eventBus.$on('close-modal', this.close)
  },
  beforeDestroy() {
    this.$eventBus.$off('librarian-sheet', this.show)
    this.$eventBus.$off('close-modal', this.close)
  }
}
</script>
