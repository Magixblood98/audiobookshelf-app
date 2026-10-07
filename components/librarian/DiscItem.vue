<template>
  <button type="button" class="flex-none text-left" :style="{ width: grid ? 'auto' : '108px', scrollSnapAlign: 'start' }" :aria-label="aria" @click="open">
    <librarian-cover :book="book" size="fill" :ribbon="ribbon" />
    <span class="lib-clamp2 lib-serif mt-2 text-sm leading-tight">{{ book.title }}</span>
    <span class="block mt-0.5 text-xs text-fg-muted truncate">{{ book.author_name || '' }}</span>
  </button>
</template>

<script>
import { bestStatus, STATUS_TEXT } from '@/plugins/librarian'

/** A cover in a Discover shelf or grid: opens the book if it's tracked, otherwise the Add sheet */
export default {
  props: {
    book: { type: Object, required: true },
    grid: Boolean
  },
  computed: {
    status() {
      return this.book.book_id ? bestStatus(this.book) : null
    },
    ribbon() {
      return ['have', 'wanted', 'snatched'].includes(this.status) ? this.status : null
    },
    aria() {
      return `${this.book.title}${this.book.author_name ? ' by ' + this.book.author_name : ''}${this.status ? '. ' + STATUS_TEXT[this.status] : ''}`
    }
  },
  methods: {
    open() {
      if (this.book.book_id) this.$librarian.openBook(this.book.book_id)
      else this.$librarian.openAddBook(this.book)
    }
  }
}
</script>
