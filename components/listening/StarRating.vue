<template>
  <div class="flex items-center justify-center gap-0.5" role="radiogroup" aria-label="Your rating">
    <button v-for="n in 5" :key="n" type="button" role="radio" :aria-checked="String(n === rating)" :aria-label="`${n} star${n === 1 ? '' : 's'}`" class="material-symbols text-2xl leading-none" :class="n <= rating ? 'fill text-warning' : 'text-fg-muted opacity-50'" @click="rate(n)">star</button>
  </div>
</template>

<script>
/** Your own 1–5 star rating for a book, kept on this phone. Tap the current rating again to clear it. */
export default {
  props: {
    libraryItemId: String
  },
  computed: {
    rating() {
      return this.$store.state.listening.ratings[this.libraryItemId] || 0
    }
  },
  methods: {
    async rate(n) {
      await this.$hapticsImpact()
      this.$listening.setRating(this.libraryItemId, n === this.rating ? 0 : n)
    }
  }
}
</script>
