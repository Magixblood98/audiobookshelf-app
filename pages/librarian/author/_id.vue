<template>
  <librarian-page :title="author ? author.name : 'Author'" tab="library" @retry="load">
    <p v-if="!author" class="py-8 text-center text-fg-muted">{{ error || 'Loading…' }}</p>
    <template v-else>
      <div class="flex items-center gap-4 px-4 pt-4 pb-3">
        <librarian-avatar :url="author.photo_url" :name="author.name" large />
        <div class="flex-grow min-w-0">
          <p class="text-sm text-fg-muted leading-snug">{{ followText }}</p>
          <div class="flex flex-wrap gap-2 mt-2.5">
            <button v-if="!author.followed" type="button" class="lib-btn small primary" :disabled="busy" @click="follow">Follow</button>
            <button type="button" class="lib-btn small" @click="openMenu">Options</button>
          </div>
        </div>
      </div>
      <template v-if="author.bio">
        <p class="lib-serif text-fg-muted px-4 leading-relaxed" :class="{ 'lib-clamp': !showBio }">{{ author.bio }}</p>
        <button v-if="!showBio" type="button" class="lib-btn quiet small ml-1" @click="showBio = true">Read more</button>
      </template>

      <div v-if="!books.length" class="mx-4 mt-4 p-3 rounded-xl bg-bg-hover/40 border-l-4 text-sm" style="border-left-color: var(--lib-get)">
        {{ author.refreshing ? 'Fetching this author’s books from Open Library…' : 'No books here yet.' }}
      </div>
      <template v-else>
        <librarian-shelf :books="books" :animate="firstVisit" class="mt-3" />
        <h3 class="lib-serif font-semibold px-4 pt-6 pb-2">{{ books.length }} book{{ books.length === 1 ? '' : 's' }}, newest first</h3>
        <div class="border-t border-border">
          <librarian-book-row v-for="b in books" :key="b.id" :book="b" />
        </div>
      </template>
    </template>
  </librarian-page>
</template>

<script>
import { MON } from '@/plugins/librarian'

const seen = new Set()

export default {
  data() {
    return { author: null, books: [], error: '', busy: false, showBio: false, firstVisit: false, poll: null }
  },
  computed: {
    id() {
      return this.$route.params.id
    },
    followText() {
      const a = this.author
      if (!a.followed) return 'Not following. Only books you added yourself are here.'
      return a.monitor === 'none' ? 'Following. New books aren’t wanted automatically.' : `Following. New ${MON[a.monitor]} are wanted automatically.`
    }
  },
  watch: {
    // The layout keys <Nuxt> by language, so this page is reused when moving between authors
    id() {
      this.author = null
      this.books = []
      this.showBio = false
      this.load()
    }
  },
  methods: {
    async load() {
      try {
        const d = await this.$librarian.get('/api/authors/' + this.id)
        this.author = d.author
        this.books = d.books
        clearInterval(this.poll)
        if (this.author.refreshing) this.poll = setInterval(() => !document.hidden && this.load(), 2500)
      } catch (error) {
        this.error = error.message
      }
    },
    async follow() {
      this.busy = true
      try {
        await this.$librarian.patch(`/api/authors/${this.author.id}`, { followed: true })
        this.$toast.success(`Following ${this.author.name}`)
        this.$librarian.changed({ authorId: this.author.id })
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    openMenu() {
      this.$librarian.openSheet({ type: 'authorMenu', author: this.author, bookCount: this.books.length })
    },
    onChanged() {
      this.load()
    }
  },
  mounted() {
    this.firstVisit = !seen.has(this.id)
    seen.add(this.id)
    this.load()
    this.$eventBus.$on('librarian-changed', this.onChanged)
  },
  beforeDestroy() {
    clearInterval(this.poll)
    this.$eventBus.$off('librarian-changed', this.onChanged)
  }
}
</script>
