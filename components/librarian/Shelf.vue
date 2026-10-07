<template>
  <div>
    <div ref="shelf" class="lib-shelf" :class="{ anim: animate }" role="list" aria-label="Bookshelf, oldest first">
      <button v-for="(b, i) in sorted" :key="b.id" type="button" role="listitem" class="lib-spine" :class="spineClass(b)" :style="spineStyle(b, i)" :title="b.title" :aria-label="label(b)" @click="$librarian.openBook(b.id)">
        <i class="band" /><i class="band b2" />{{ b.title }}
        <span class="marks">
          <span v-if="b.ebook_status === 'have'" class="material-symbols" style="font-size: 13px">menu_book</span>
          <span v-if="b.audio_status === 'have'" class="material-symbols" style="font-size: 13px">headphones</span>
        </span>
      </button>
    </div>
    <div class="lib-legend flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 pb-1 text-xs text-fg-muted">
      <span v-for="l in legend" :key="l[0]"><i :class="'s-' + l[0]" />{{ l[1] }}</span>
      <span class="basis-full w-full opacity-70">Each spine shows the book’s furthest-along format. Icons at its foot mark the formats you have.</span>
    </div>
  </div>
</template>

<script>
import { bestStatus, hashStr, STATUS_TEXT } from '@/plugins/librarian'

export default {
  props: {
    books: { type: Array, default: () => [] },
    animate: Boolean
  },
  data() {
    return {
      legend: [
        ['have', 'In library'],
        ['snatched', 'Downloading'],
        ['wanted', 'Wanted'],
        ['skipped', 'Not wanted']
      ]
    }
  },
  computed: {
    sorted() {
      return [...this.books].sort((a, b) => (a.year || 9999) - (b.year || 9999) || a.title.localeCompare(b.title))
    }
  },
  methods: {
    spineClass(b) {
      const best = bestStatus(b)
      const x = hashStr(b.title + b.id)
      return ['s-' + best, best === 'skipped' ? 't' + (1 + (x % 4)) : '']
    },
    spineStyle(b, i) {
      const x = hashStr(b.title + b.id)
      return { height: 140 + (x % 46) + 'px', width: 28 + ((x >> 5) % 12) + 'px', '--i': i }
    },
    label(b) {
      return `${b.title}${b.year ? ', ' + b.year : ''}. Ebook ${STATUS_TEXT[b.ebook_status].toLowerCase()}, audiobook ${STATUS_TEXT[b.audio_status].toLowerCase()}.`
    }
  }
}
</script>
