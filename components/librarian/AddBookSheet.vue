<template>
  <div>
    <div class="flex gap-4 px-5 pb-4">
      <librarian-cover :book="book" size="lg" />
      <div class="flex-grow min-w-0">
        <h2 class="lib-serif text-xl font-semibold leading-tight">{{ book.title }}</h2>
        <p v-if="book.subtitle" class="lib-serif italic text-fg-muted mt-1">{{ book.subtitle }}</p>
        <p class="text-fg-muted mt-1">{{ book.author_name || '' }}</p>
        <p v-if="book.year" class="text-sm text-fg-muted">First published {{ book.year }}</p>
        <button v-if="book.author_id" type="button" class="mt-2 font-medium lib-text-want" @click="goAuthor">See {{ book.author_name }} in your library</button>
        <button v-else-if="book.author_ol" type="button" class="lib-btn quiet small -ml-2.5 mt-1" @click="followAuthor">Follow {{ book.author_name || 'this author' }}</button>
      </div>
    </div>
    <div class="grid gap-2.5 px-5">
      <button type="button" class="lib-btn primary" :disabled="busy" @click="add(['audio'])"><span class="material-symbols">headphones</span>Want the audiobook</button>
      <button type="button" class="lib-btn" :disabled="busy" @click="add(['ebook'])"><span class="material-symbols">menu_book</span>Want the ebook</button>
      <button type="button" class="lib-btn" :disabled="busy" @click="add(['ebook', 'audio'])">Want both</button>
      <button type="button" class="lib-btn quiet" :disabled="busy" @click="add([])">Add without wanting it</button>
      <button v-if="book.ol_work" type="button" class="lib-btn quiet" :disabled="busy" @click="hide">Not interested</button>
    </div>
    <template v-if="description">
      <h3 class="lib-serif font-semibold px-5 pt-5 pb-1">About this book</h3>
      <p class="lib-serif text-fg-muted px-5 whitespace-pre-line leading-relaxed" :class="{ 'lib-clamp': !showDesc }">{{ description }}</p>
      <button v-if="!showDesc" type="button" class="lib-btn quiet small ml-2" @click="showDesc = true">Read more</button>
    </template>
  </div>
</template>

<script>
export default {
  props: {
    book: { type: Object, required: true }
  },
  data() {
    return { busy: false, description: '', showDesc: false }
  },
  methods: {
    async add(want) {
      this.busy = true
      try {
        const r = await this.$librarian.post('/api/books', { book: this.book, want })
        this.$toast.success(want.length ? 'Added and wanted' : 'Added to your library')
        this.$librarian.changed({ bookId: r.id, olWork: this.book.ol_work })
        this.$librarian.openBook(r.id)
      } catch (error) {
        this.$toast.error(error.message)
        this.busy = false
      }
    },
    async hide() {
      this.busy = true
      try {
        await this.$librarian.post('/api/discover/hide', { ol_work: this.book.ol_work })
        this.$toast.success('You won’t see it in Discover again')
        this.$librarian.eventBus.$emit('librarian-hidden', this.book.ol_work)
        this.$emit('close')
      } catch (error) {
        this.$toast.error(error.message)
        this.busy = false
      }
    },
    goAuthor() {
      this.$emit('close')
      this.$router.push('/librarian/author/' + this.book.author_id)
    },
    followAuthor() {
      this.$librarian.openAddAuthor({ ol_id: this.book.author_ol, name: this.book.author_name, photo_url: this.book.author_photo, top_work: this.book.title })
    }
  },
  mounted() {
    if (this.book.ol_work) {
      this.$librarian
        .get('/api/lookup/work/' + this.book.ol_work)
        .then((d) => (this.description = d.description || ''))
        .catch(() => {})
    }
  }
}
</script>
