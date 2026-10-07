<template>
  <div>
    <h2 class="lib-serif text-xl font-semibold px-5">{{ author.name }}</h2>
    <template v-if="author.followed">
      <h3 class="lib-serif font-semibold px-5 pt-5 pb-2">When a new book comes out</h3>
      <div class="px-5">
        <librarian-seg wide :options="monitorOptions" :value="author.monitor" @input="setMonitor" />
      </div>
    </template>
    <h3 class="lib-serif font-semibold px-5 pt-5 pb-2">Everything by this author</h3>
    <div class="flex flex-wrap gap-2 px-5">
      <button type="button" class="lib-btn" :disabled="busy" @click="wantAll('ebook')"><span class="material-symbols">menu_book</span>Want all ebooks</button>
      <button type="button" class="lib-btn" :disabled="busy" @click="wantAll('audio')"><span class="material-symbols">headphones</span>Want all audiobooks</button>
    </div>
    <h3 class="lib-serif font-semibold px-5 pt-5 pb-2">Keep tidy</h3>
    <div class="flex flex-wrap gap-2 px-5">
      <button v-if="author.ol_id" type="button" class="lib-btn" :disabled="busy" @click="refresh"><span class="material-symbols">refresh</span>Check for new books</button>
      <button v-else type="button" class="lib-btn" @click="$librarian.openSheet({ type: 'matchAuthor', author })"><span class="material-symbols">search</span>Match on Open Library</button>
      <button v-if="author.followed" type="button" class="lib-btn" :disabled="busy" @click="unfollow">Stop following</button>
      <button type="button" class="lib-btn danger" :disabled="busy" @click="remove"><span class="material-symbols">delete</span>Remove</button>
    </div>
  </div>
</template>

<script>
import { Dialog } from '@capacitor/dialog'
import { MON } from '@/plugins/librarian'

export default {
  props: {
    author: { type: Object, required: true },
    bookCount: { type: Number, default: 0 }
  },
  data() {
    return {
      busy: false,
      monitorOptions: [
        ['none', 'Nothing'],
        ['ebook', 'Ebook'],
        ['audio', 'Audiobook'],
        ['both', 'Both']
      ]
    }
  },
  methods: {
    async run(fn, msg) {
      this.busy = true
      try {
        const r = await fn()
        if (msg) this.$toast.success(typeof msg === 'function' ? msg(r) : msg)
        this.$librarian.changed({ authorId: this.author.id })
        return r
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    async setMonitor(v) {
      await this.run(() => this.$librarian.patch(`/api/authors/${this.author.id}`, { monitor: v }), v === 'none' ? 'New books won’t be wanted' : `New ${MON[v]} will be wanted`)
      this.$emit('close')
    },
    async wantAll(kind) {
      await this.run(() => this.$librarian.post(`/api/authors/${this.author.id}/wantall`, { kind }), (r) => (r.count ? `Wanted ${r.count} more` : 'Everything is already wanted or in your library'))
      this.$emit('close')
    },
    async refresh() {
      await this.run(() => this.$librarian.post(`/api/authors/${this.author.id}/refresh`), (r) => r.message)
      this.$emit('close')
    },
    async unfollow() {
      await this.run(() => this.$librarian.patch(`/api/authors/${this.author.id}`, { followed: false }), 'Stopped following')
      this.$emit('close')
    },
    async remove() {
      const n = this.bookCount
      const { value } = await Dialog.confirm({ title: 'Remove author', message: `Remove ${this.author.name} and ${n} book${n === 1 ? '' : 's'} from Pocket Librarian? Files on this device stay where they are.` })
      if (!value) return
      const ok = await this.run(() => this.$librarian.delete(`/api/authors/${this.author.id}`), `Removed ${this.author.name}`)
      if (ok) {
        this.$emit('close')
        this.$router.replace('/librarian')
      }
    }
  }
}
</script>
