<template>
  <section v-if="!gone" class="mb-5">
    <div class="flex items-end gap-2 px-4 pt-1.5 pb-3">
      <div class="flex-grow min-w-0">
        <h2 class="lib-serif text-lg font-semibold leading-tight">{{ shownTitle }}</h2>
        <p v-if="sub" class="text-sm text-fg-muted mt-0.5">{{ sub }}</p>
      </div>
      <nuxt-link v-if="shownHref" :to="shownHref" class="lib-btn quiet small">See all</nuxt-link>
    </div>
    <p v-if="error" class="px-4 text-xs text-error">{{ error }}</p>
    <div v-else class="lib-hscroll">
      <template v-if="!books">
        <div v-for="i in 4" :key="i" class="flex-none" style="width: 108px"><div class="lib-cover fill bg-bg-hover" /></div>
      </template>
      <librarian-disc-item v-for="b in visibleBooks" :key="b.ol_work || b.id || b.title" :book="b" />
    </div>
  </section>
</template>

<script>
/** A horizontally scrolling Discover shelf. `load` resolves to { books, title?, href?, sub? } */
export default {
  props: {
    title: String,
    href: String,
    load: { type: Function, required: true }
  },
  data() {
    return { books: null, sub: '', loadedTitle: '', loadedHref: '', error: '', gone: false, hidden: [] }
  },
  computed: {
    shownTitle() {
      return this.loadedTitle || this.title
    },
    shownHref() {
      return this.loadedHref || this.href
    },
    visibleBooks() {
      return (this.books || []).filter((b) => !this.hidden.includes(b.ol_work))
    }
  },
  methods: {
    onHidden(olw) {
      this.hidden.push(olw)
    }
  },
  async mounted() {
    this.$eventBus.$on('librarian-hidden', this.onHidden)
    try {
      const r = await this.load()
      if (!r || !r.books.length) return (this.gone = true)
      this.books = r.books
      this.sub = r.sub || ''
      this.loadedTitle = r.title || ''
      this.loadedHref = r.href || ''
    } catch (error) {
      this.error = error.message
    }
  },
  beforeDestroy() {
    this.$eventBus.$off('librarian-hidden', this.onHidden)
  }
}
</script>
