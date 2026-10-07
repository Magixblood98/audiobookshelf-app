<template>
  <div>
    <template v-for="(f, i) in normalized">
      <h3 v-if="f.heading" :key="'h' + i" class="lib-serif font-semibold px-5 pt-5 pb-1">{{ f.heading }}</h3>
      <label v-else-if="f.type === 'toggle'" :key="f.key" class="flex items-center gap-4 px-5 py-3">
        <span class="flex-grow">
          <span class="block">{{ f.label }}</span>
          <span v-if="f.help" class="block text-xs text-fg-muted mt-1 leading-snug">{{ f.help }}</span>
        </span>
        <input v-model="vals[f.key]" type="checkbox" class="lib-switch" />
      </label>
      <div v-else :key="f.key" class="px-5 py-2.5">
        <label class="block text-sm text-fg-muted mb-1.5" :for="'lf-' + uid + f.key">{{ f.label }}</label>
        <select v-if="f.type === 'select'" :id="'lf-' + uid + f.key" v-model="vals[f.key]" class="lib-input">
          <option v-for="o in f.opts" :key="o[0]" :value="o[0]">{{ o[1] }}</option>
        </select>
        <textarea v-else-if="f.type === 'textarea'" :id="'lf-' + uid + f.key" v-model="vals[f.key]" rows="3" class="lib-input" />
        <input v-else :id="'lf-' + uid + f.key" v-model="vals[f.key]" class="lib-input" :type="f.type === 'number' ? 'text' : f.type" :inputmode="f.type === 'number' ? 'decimal' : null" :placeholder="f.opts && f.opts.placeholder" autocomplete="off" autocapitalize="off" spellcheck="false" />
        <p v-if="f.help" class="text-xs text-fg-muted mt-1.5 leading-snug">{{ f.help }}</p>
      </div>
    </template>
  </div>
</template>

<script>
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o)
function setPath(o, p, v) {
  const ks = p.split('.')
  let c = o
  for (const k of ks.slice(0, -1)) c = c[k] = c[k] || {}
  c[ks[ks.length - 1]] = v
  return o
}

/**
 * Settings form in Pocket Librarian's field format: [key, label, type, help, opts] or a heading string.
 * Keys are dotted paths into `values`; patch() returns the nested object to send to PUT /api/config.
 */
export default {
  props: {
    fields: { type: Array, required: true },
    values: { type: Object, default: () => ({}) }
  },
  data() {
    return { vals: {}, uid: Math.random().toString(36).slice(2, 6) }
  },
  computed: {
    normalized() {
      return this.fields.map((f) => (typeof f === 'string' ? { heading: f } : { key: f[0], label: f[1], type: f[2] || 'text', help: f[3], opts: f[4] }))
    }
  },
  watch: {
    values: {
      immediate: true,
      handler() {
        const vals = {}
        this.normalized.forEach((f) => {
          if (!f.key) return
          const v = getPath(this.values, f.key)
          vals[f.key] = f.type === 'toggle' ? !!v : v == null ? '' : f.type === 'select' ? String(v) : v
        })
        this.vals = vals
      }
    }
  },
  methods: {
    patch() {
      const p = {}
      this.normalized.forEach((f) => {
        if (!f.key) return
        let v = this.vals[f.key]
        if (f.type === 'number') v = parseFloat(v) || 0
        else if (typeof v === 'string') v = v.trim()
        setPath(p, f.key, v)
      })
      return p
    }
  }
}
</script>
