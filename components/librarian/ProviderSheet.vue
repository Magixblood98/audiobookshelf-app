<template>
  <div>
    <h2 class="lib-serif text-xl font-semibold px-5">{{ provider ? 'Edit indexer' : 'Add an indexer' }}</h2>
    <librarian-form ref="form" :fields="fields" :values="values" />
    <div class="flex flex-wrap gap-2 px-5 pt-2">
      <button type="button" class="lib-btn" :disabled="busy" @click="test">Test</button>
      <button type="button" class="lib-btn primary" :disabled="busy" @click="save">Save</button>
      <button v-if="provider" type="button" class="lib-btn danger" :disabled="busy" @click="remove">Remove</button>
    </div>
  </div>
</template>

<script>
import { Dialog } from '@capacitor/dialog'

export default {
  props: {
    provider: Object,
    index: { type: Number, default: -1 },
    providers: { type: Array, default: () => [] }
  },
  data() {
    return {
      busy: false,
      fields: [
        ['name', 'Name'],
        ['type', 'Kind', 'select', 'Prowlarr searches all of its indexers at once. Torznab and Newznab feeds come from Prowlarr, Jackett or a Usenet indexer.', [['prowlarr', 'Prowlarr'], ['torznab', 'Torznab feed'], ['newznab', 'Newznab feed']]],
        ['url', 'Address', 'url', 'Like http://100.101.102.103:9696 for Prowlarr, or a feed address ending in /api.', { placeholder: 'http://' }],
        ['api_key', 'API key', 'password', 'In Prowlarr: Settings, then General, then API Key.'],
        ['kinds', 'Use it for', 'select', null, [['both', 'Ebooks and audiobooks'], ['ebook', 'Ebooks only'], ['audio', 'Audiobooks only']]],
        ['audio_categories', 'Audiobook categories', 'text', 'Leave empty to use the ones in Search rules.'],
        ['ebook_categories', 'Ebook categories'],
        ['enabled', 'Use this indexer', 'toggle']
      ]
    }
  },
  computed: {
    values() {
      return { name: 'Prowlarr', type: 'prowlarr', url: '', api_key: '', enabled: true, kinds: 'both', ebook_categories: '', audio_categories: '', ...(this.provider || {}) }
    }
  },
  methods: {
    current() {
      return { ...this.values, ...this.$refs.form.patch() }
    },
    async test() {
      this.busy = true
      try {
        const r = await this.$librarian.post('/api/test/provider', { provider: this.current() })
        this.$toast.success(r.message)
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    async saveList(list, msg) {
      this.busy = true
      try {
        await this.$librarian.put('/api/config', { providers: list })
        this.$toast.success(msg)
        this.$librarian.changed({ config: true })
        this.$emit('close')
      } catch (error) {
        this.$toast.error(error.message)
        this.busy = false
      }
    },
    save() {
      const list = [...this.providers]
      if (this.index >= 0) list[this.index] = this.current()
      else list.push(this.current())
      this.saveList(list, 'Indexers saved')
    },
    async remove() {
      const { value } = await Dialog.confirm({ title: 'Remove indexer', message: `Remove ${this.values.name}?` })
      if (value) this.saveList(this.providers.filter((_, i) => i !== this.index), 'Indexer removed')
    }
  }
}
</script>
