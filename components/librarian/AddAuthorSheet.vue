<template>
  <div>
    <div class="flex items-center gap-4 px-5 pb-2">
      <librarian-avatar :url="author.photo_url" :name="author.name" large />
      <div class="flex-grow min-w-0">
        <h2 class="lib-serif text-xl font-semibold leading-tight">{{ author.name }}</h2>
        <div class="flex flex-wrap gap-x-3 text-sm text-fg-muted mt-1">
          <span v-if="author.top_work">Known for {{ author.top_work }}</span>
          <span v-if="author.work_count != null">{{ author.work_count }} works on Open Library</span>
        </div>
      </div>
    </div>
    <h3 class="lib-serif font-semibold px-5 pt-4 pb-1">Books already out</h3>
    <label v-for="o in initialOptions" :key="'i-' + o[0]" class="flex items-start gap-3 px-5 py-2.5">
      <input v-model="initial" type="radio" name="initial" class="lib-radio" :value="o[0]" />
      <span>{{ o[1] }}<span v-if="o[2]" class="block text-xs text-fg-muted mt-0.5">{{ o[2] }}</span></span>
    </label>
    <h3 class="lib-serif font-semibold px-5 pt-4 pb-1">New releases</h3>
    <label v-for="o in monitorOptions" :key="'m-' + o[0]" class="flex items-start gap-3 px-5 py-2.5">
      <input v-model="monitor" type="radio" name="monitor" class="lib-radio" :value="o[0]" />
      <span>{{ o[1] }}</span>
    </label>
    <div class="px-5 pt-3">
      <button type="button" class="lib-btn primary block" :disabled="busy" @click="follow">Follow {{ author.name }}</button>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    author: { type: Object, required: true }
  },
  data() {
    return {
      busy: false,
      initial: 'skip',
      monitor: 'audio',
      initialOptions: [
        ['skip', 'Just follow', 'They appear on the shelf. Tap Want on the ones you’d like.'],
        ['ebook', 'Want every ebook'],
        ['audio', 'Want every audiobook'],
        ['both', 'Want both formats']
      ],
      monitorOptions: [
        ['none', 'Don’t want them automatically'],
        ['ebook', 'Want the ebook'],
        ['audio', 'Want the audiobook'],
        ['both', 'Want both formats']
      ]
    }
  },
  methods: {
    async follow() {
      this.busy = true
      try {
        const r = await this.$librarian.post('/api/authors', { ol_id: this.author.ol_id, initial: this.initial, monitor: this.monitor })
        this.$toast.success(`Following ${this.author.name}`)
        this.$librarian.changed({ authorId: r.id })
        this.$emit('close')
        this.$router.push('/librarian/author/' + r.id)
      } catch (error) {
        this.$toast.error(error.message)
        this.busy = false
      }
    }
  }
}
</script>
