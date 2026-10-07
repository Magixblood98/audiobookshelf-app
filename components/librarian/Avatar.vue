<template>
  <div class="lib-avatar" :class="{ lg: large }" aria-hidden="true">
    <span>{{ letters }}</span>
    <img v-if="url && !failed" :src="url" alt="" loading="lazy" @error="failed = true" @load="checkSize" />
  </div>
</template>

<script>
import { initials } from '@/plugins/librarian'

export default {
  props: {
    url: String,
    name: String,
    large: Boolean
  },
  data() {
    return { failed: false }
  },
  computed: {
    letters() {
      return initials(this.name)
    }
  },
  methods: {
    checkSize(e) {
      // Open Library returns a 1px image for authors without a photo
      if (e.target.naturalWidth < 3) this.failed = true
    }
  }
}
</script>
