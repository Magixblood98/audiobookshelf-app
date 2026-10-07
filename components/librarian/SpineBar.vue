<template>
  <div class="lib-spinebar" aria-hidden="true">
    <i v-for="(c, i) in spines" :key="i" :class="c" :style="{ height: heights[i] }" />
  </div>
</template>

<script>
import { hashStr } from '@/plugins/librarian'

export default {
  props: { code: String },
  computed: {
    spines() {
      return [...(this.code || '')].slice(0, 56)
    },
    heights() {
      return this.spines.map((c, i) => 11 + (hashStr('s' + i) % 11) + 'px')
    }
  }
}
</script>
