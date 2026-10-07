<template>
  <div class="lib-cover" :class="size" :style="{ background: cloth }" aria-hidden="true">
    <span>{{ letters }}</span>
    <img v-if="src && !failed" :src="src" alt="" loading="lazy" decoding="async" @error="failed = true" />
    <i v-if="ribbon" class="lib-ribbon" :class="'s-' + ribbon" />
  </div>
</template>

<script>
import { CLOTH, hashStr, initials } from '@/plugins/librarian'

export default {
  props: {
    book: { type: Object, default: () => ({}) },
    size: { type: String, default: '' },
    ribbon: String
  },
  data() {
    return { failed: false }
  },
  watch: {
    src() {
      this.failed = false
    }
  },
  computed: {
    src() {
      return this.$librarian.coverUrl(this.book)
    },
    cloth() {
      return CLOTH[hashStr(this.book.title) % CLOTH.length]
    },
    letters() {
      return initials(this.book.title)
    }
  }
}
</script>
