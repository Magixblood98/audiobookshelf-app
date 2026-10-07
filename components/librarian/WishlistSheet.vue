<template>
  <div>
    <h2 class="lib-serif text-xl font-semibold px-5">{{ wishlist ? 'Edit wishlist' : 'Add a wishlist' }}</h2>
    <librarian-form ref="form" :fields="fields" :values="values" />
    <div class="flex flex-wrap gap-2 px-5 pt-2">
      <button type="button" class="lib-btn primary" :disabled="busy" @click="save">Save</button>
      <button v-if="wishlist" type="button" class="lib-btn danger" :disabled="busy" @click="remove">Remove</button>
    </div>
  </div>
</template>

<script>
import { Dialog } from '@capacitor/dialog'

export default {
  props: {
    wishlist: Object,
    index: { type: Number, default: -1 },
    wishlists: { type: Array, default: () => [] }
  },
  data() {
    return {
      busy: false,
      fields: [
        ['name', 'Name'],
        ['url', 'Feed address', 'url', 'An RSS feed. Goodreads: open your shelf, then the RSS link at the bottom.', { placeholder: 'https://' }],
        ['kind', 'Want new books as', 'select', null, [['audio', 'Audiobooks'], ['ebook', 'Ebooks'], ['both', 'Both formats']]],
        ['enabled', 'Check this list', 'toggle']
      ]
    }
  },
  computed: {
    values() {
      return { name: 'Goodreads to-read', url: '', kind: 'audio', enabled: true, ...(this.wishlist || {}) }
    }
  },
  methods: {
    async saveList(list, msg) {
      this.busy = true
      try {
        await this.$librarian.put('/api/config', { wishlists: list })
        this.$toast.success(msg)
        this.$librarian.changed({ config: true })
        this.$emit('close')
      } catch (error) {
        this.$toast.error(error.message)
        this.busy = false
      }
    },
    save() {
      const list = [...this.wishlists]
      const v = { ...this.values, ...this.$refs.form.patch() }
      if (this.index >= 0) list[this.index] = v
      else list.push(v)
      this.saveList(list, 'Wishlists saved')
    },
    async remove() {
      const { value } = await Dialog.confirm({ title: 'Remove wishlist', message: `Remove ${this.values.name}?` })
      if (value) this.saveList(this.wishlists.filter((_, i) => i !== this.index), 'Wishlist removed')
    }
  }
}
</script>
