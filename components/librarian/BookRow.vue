<template>
  <div class="flex items-center gap-3 px-4 py-3 border-b border-border active:bg-bg-hover/40" role="button" tabindex="0" @click="$librarian.openBook(book.id)">
    <librarian-cover :book="book" />
    <div class="flex-grow min-w-0">
      <p class="lib-serif text-base leading-snug">{{ book.title }}</p>
      <div v-if="meta.length" class="flex flex-wrap gap-x-3 mt-0.5 text-sm text-fg-muted">
        <span v-for="(m, i) in meta" :key="i">{{ m }}</span>
      </div>
      <div class="flex flex-wrap gap-1.5 mt-2">
        <librarian-status-chip :book="book" kind="ebook" @changed="$emit('changed', $event)" />
        <librarian-status-chip :book="book" kind="audio" @changed="$emit('changed', $event)" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    book: { type: Object, required: true },
    showAuthor: Boolean,
    extra: String
  },
  computed: {
    meta() {
      const b = this.book
      const m = []
      if (this.showAuthor && b.author_name) m.push(b.author_name)
      if (b.series) m.push(b.series + (b.series_num ? ' #' + b.series_num : ''))
      if (b.year) m.push(b.year)
      if (this.extra) m.push(this.extra)
      return m
    }
  }
}
</script>
