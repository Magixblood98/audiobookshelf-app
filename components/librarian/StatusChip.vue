<template>
  <button type="button" class="lib-chip" :class="status" :disabled="busy" :aria-label="aria" @click.stop="click">
    <span class="material-symbols" style="font-size: 16px">{{ kind === 'ebook' ? 'menu_book' : 'headphones' }}</span>
    {{ label }}
  </button>
</template>

<script>
import { KIND, STATUS_TEXT } from '@/plugins/librarian'

/** One-tap Want toggle for a format, like Pocket Librarian's book-row chips */
export default {
  props: {
    book: { type: Object, required: true },
    kind: { type: String, required: true }
  },
  data() {
    return { busy: false }
  },
  computed: {
    status() {
      return this.book[this.kind + '_status']
    },
    label() {
      return this.status === 'skipped' ? 'Want' : this.status === 'have' ? 'Have' : STATUS_TEXT[this.status]
    },
    aria() {
      const tip = this.status === 'skipped' ? 'Tap to want it.' : this.status === 'wanted' ? 'Tap to stop wanting it.' : 'Tap for details.'
      return `${KIND[this.kind]}: ${STATUS_TEXT[this.status]}. ${tip}`
    }
  },
  methods: {
    async click() {
      if (this.status !== 'skipped' && this.status !== 'wanted') return this.$librarian.openBook(this.book.id)
      const next = this.status === 'skipped' ? 'wanted' : 'skipped'
      this.busy = true
      try {
        await this.$librarian.patch(`/api/books/${this.book.id}`, { [this.kind + '_status']: next })
        this.$set(this.book, this.kind + '_status', next)
        this.$toast.success(next === 'wanted' ? `Wanted the ${KIND[this.kind].toLowerCase()}` : `Stopped wanting the ${KIND[this.kind].toLowerCase()}`)
        this.$emit('changed', this.book)
        this.$librarian.loadStatus().catch(() => {})
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    }
  }
}
</script>
