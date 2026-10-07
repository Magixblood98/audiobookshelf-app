<template>
  <librarian-page :title="section ? section.title : 'Settings'" tab="settings" :gate="id !== 'connection'" @retry="load">
    <!-- Connection lives in the app, so it works even when the server is down -->
    <template v-if="id === 'connection'">
      <p class="text-sm text-fg-muted px-5 pt-4">Where this app finds Pocket Librarian. On this phone it’s http://127.0.0.1:5300. Pocket Librarian on your Pi works too, through its Tailscale address.</p>
      <div class="px-5 pt-4">
        <label class="block text-sm text-fg-muted mb-1.5">Address</label>
        <input v-model="conn.url" type="url" class="lib-input" placeholder="http://127.0.0.1:5300" autocomplete="off" autocapitalize="off" />
        <label class="block text-sm text-fg-muted mb-1.5 mt-4">API key</label>
        <input v-model="conn.apiKey" type="password" class="lib-input" autocomplete="off" />
        <p class="text-xs text-fg-muted mt-1.5">Only needed when Pocket Librarian has a password. It’s under Security & server.</p>
        <p v-if="connResult" class="text-sm mt-3" :class="connResult.ok ? 'text-success' : 'text-error'">{{ connResult.text }}</p>
        <div class="flex flex-wrap gap-2 mt-4">
          <button type="button" class="lib-btn primary" :disabled="busy" @click="saveConnection">Save and connect</button>
          <button type="button" class="lib-btn" :disabled="busy" @click="startServer"><span class="material-symbols">play_arrow</span>Start Pocket Librarian</button>
        </div>
        <p class="text-xs text-fg-muted mt-4 leading-relaxed">Start works when Pocket Librarian is on this phone. The first time, Android asks to let this app run commands in Termux. Termux also needs <code>allow-external-apps = true</code> in ~/.termux/termux.properties.</p>
      </div>
    </template>

    <p v-else-if="!cfg" class="py-8 text-center text-fg-muted">Loading…</p>

    <!-- Indexers -->
    <template v-else-if="id === 'indexers'">
      <p class="text-sm text-fg-muted px-5 pt-4 pb-3">Indexers are where Pocket Librarian looks for releases. With Prowlarr, one entry covers every indexer you’ve added there.</p>
      <p v-if="!cfg.providers.length" class="mx-4 mb-3 p-3 rounded-xl bg-bg-hover/40 text-sm">No indexers yet. Prowlarr usually runs on port 9696. Use an address this phone can reach from anywhere, like a Tailscale IP.</p>
      <div class="border-t border-border">
        <button v-for="(p, i) in cfg.providers" :key="p.id || i" type="button" class="w-full flex items-center gap-3 px-4 py-3 border-b border-border text-left" @click="editProvider(p, i)">
          <div class="flex-grow min-w-0">
            <p class="lib-serif">{{ p.name || 'Indexer' }}</p>
            <div class="flex flex-wrap gap-x-3 text-sm text-fg-muted">
              <span>{{ PROV_TYPES[p.type] || p.type }}</span>
              <span>{{ PROV_USE[p.kinds || 'both'] }}</span>
              <span v-if="p.enabled === false">Turned off</span>
            </div>
          </div>
          <span class="material-symbols text-fg-muted">chevron_right</span>
        </button>
      </div>
      <div class="px-5 pt-4"><button type="button" class="lib-btn primary" @click="editProvider(null, -1)"><span class="material-symbols">add</span>Add an indexer</button></div>
    </template>

    <!-- Downloads -->
    <template v-else-if="id === 'downloads'">
      <p class="text-sm text-fg-muted px-5 pt-4">Where releases go. Real-Debrid fetches torrents on its own servers, so nothing is shared from your phone.</p>
      <div v-for="proto in ['torrent', 'usenet']" :key="proto" class="border-b border-border pb-3">
        <div class="px-5 pt-4">
          <label class="block text-sm text-fg-muted mb-1.5">{{ proto === 'torrent' ? 'Torrents go to' : 'Usenet goes to' }}</label>
          <select v-model="clientSel[proto]" class="lib-input">
            <option v-for="o in CLIENT_OPTS[proto]" :key="o[0]" :value="o[0]">{{ o[1] }}</option>
          </select>
        </div>
        <template v-if="clientSel[proto] !== 'none'">
          <librarian-form :ref="'client-' + proto" :key="proto + clientSel[proto]" :fields="clientFields(proto)" :values="cfg.clients[clientSel[proto]] || {}" />
          <div class="px-5"><button type="button" class="lib-btn small" :disabled="busy" @click="testClient(proto)">Test connection</button></div>
        </template>
      </div>
      <librarian-form ref="stall" :fields="[['clients.stall_hours', 'Give up on a stalled download after (hours)', 'number']]" :values="cfg" />
    </template>

    <!-- Notifications -->
    <template v-else-if="id === 'notifications'">
      <h3 class="lib-serif font-semibold px-5 pt-4">Tell me</h3>
      <librarian-form ref="events" :fields="notifyEvents" :values="cfg.notifications" />
      <div v-for="c in CHANNELS" :key="c[0]" class="border-t border-border mt-2">
        <librarian-form :ref="'ch-' + c[0]" :fields="[['enabled', c[1], 'toggle', c[3]], ...c[2]]" :values="cfg.notifications[c[0]] || {}" />
        <div class="px-5 pb-2"><button type="button" class="lib-btn small" :disabled="busy" @click="testNotify(c[0])">Send a test</button></div>
      </div>
    </template>

    <!-- Wishlists & import -->
    <template v-else-if="id === 'lists'">
      <h3 class="lib-serif font-semibold px-5 pt-4">Wishlists</h3>
      <p class="text-sm text-fg-muted px-5 pt-1 pb-3">New books on these feeds are added and wanted. A Goodreads shelf feed looks like goodreads.com/review/list_rss/12345?shelf=to-read</p>
      <div class="border-t border-border">
        <button v-for="(w, i) in cfg.wishlists" :key="w.id || i" type="button" class="w-full flex items-center gap-3 px-4 py-3 border-b border-border text-left" @click="editWishlist(w, i)">
          <div class="flex-grow min-w-0">
            <p class="lib-serif">{{ w.name || 'Wishlist' }}</p>
            <div class="flex flex-wrap gap-x-3 text-sm text-fg-muted">
              <span>{{ WANT[w.kind || 'ebook'] }}</span>
              <span v-if="w.enabled === false">Turned off</span>
            </div>
          </div>
          <span class="material-symbols text-fg-muted">chevron_right</span>
        </button>
      </div>
      <div class="flex flex-wrap gap-2 px-5 pt-3">
        <button type="button" class="lib-btn" @click="editWishlist(null, -1)"><span class="material-symbols">add</span>Add a wishlist</button>
        <button v-if="cfg.wishlists.length" type="button" class="lib-btn" :disabled="busy" @click="runAction({ path: '/api/wishlists/sync', msg: (r) => (r.started ? 'Syncing. The result shows under Activity, Jobs.' : 'Already syncing') })"><span class="material-symbols">refresh</span>Sync now</button>
      </div>

      <h3 class="lib-serif font-semibold px-5 pt-6">Import a CSV file</h3>
      <p class="text-sm text-fg-muted px-5 pt-1">Works with exports from LazyLibrarian and Goodreads, or any file with Title and Author columns.</p>
      <div class="px-5 pt-3">
        <label class="block text-sm text-fg-muted mb-1.5">File</label>
        <input ref="csv" type="file" accept=".csv,text/csv,text/plain" class="lib-input py-2" />
        <label class="block text-sm text-fg-muted mb-1.5 mt-3">Want them as</label>
        <select v-model="importKind" class="lib-input">
          <option value="audio">Audiobooks</option>
          <option value="ebook">Ebooks</option>
          <option value="both">Both formats</option>
        </select>
        <label class="block text-sm text-fg-muted mb-1.5 mt-3">Mark them as</label>
        <select v-model="importStatus" class="lib-input">
          <option value="wanted">Wanted</option>
          <option value="have">Already in my library</option>
          <option value="skipped">Just add them</option>
        </select>
        <button type="button" class="lib-btn primary mt-4" :disabled="busy" @click="importCsv">Import</button>
      </div>

      <h3 class="lib-serif font-semibold px-5 pt-6">Export</h3>
      <div class="px-5 pt-2"><button type="button" class="lib-btn" @click="$librarian.openFile('/api/export/csv')"><span class="material-symbols">download</span>Download your library as CSV</button></div>
    </template>

    <!-- Security & server -->
    <template v-else-if="id === 'security'">
      <librarian-form ref="security" :fields="securityFields" :values="securityValues" />
      <h3 class="lib-serif font-semibold px-5 pt-5">API key</h3>
      <p class="text-sm text-fg-muted px-5 pt-1">For scripts and automation apps like Tasker. Send it in an X-Api-Key header.</p>
      <code class="block mx-5 mt-2 p-3 rounded-lg bg-bg text-xs break-all font-mono">{{ showKey ? cfg.server.api_key : '••••••••••••••••' }}</code>
      <div class="flex flex-wrap gap-2 px-5 pt-2">
        <button type="button" class="lib-btn small" @click="showKey = !showKey">{{ showKey ? 'Hide' : 'Show' }}</button>
        <button type="button" class="lib-btn small" @click="copyKey">Copy</button>
        <button type="button" class="lib-btn small" :disabled="busy" @click="newKey">Make a new key</button>
      </div>
    </template>

    <!-- About -->
    <template v-else-if="id === 'about'">
      <dl class="px-5 pt-2">
        <template v-for="r in aboutRows">
          <dt :key="r[0]" class="text-sm text-fg-muted mt-4">{{ r[0] }}</dt>
          <dd :key="r[0] + 'v'" class="break-all">{{ r[1] }}</dd>
        </template>
      </dl>
      <h3 class="lib-serif font-semibold px-5 pt-6">Keeping it running</h3>
      <p class="text-sm text-fg-muted px-5 pt-1 leading-relaxed">Android pauses apps it thinks are idle. pl start holds a wake lock; also set Termux’s battery use to Unrestricted in Android settings. With the Termux:Boot app installed, Pocket Librarian starts again after the phone restarts.</p>
    </template>

    <!-- Generic field sections -->
    <template v-else-if="section && section.fields">
      <librarian-form ref="form" :fields="section.fields" :values="cfg" />
      <div v-if="section.fillFromApp && absAddress" class="px-5 pt-1">
        <button type="button" class="lib-btn small quiet -ml-2.5" @click="fillAbsAddress">Use this app’s server address ({{ absAddress }})</button>
      </div>
      <div v-if="section.actions" class="flex flex-wrap gap-2 px-5 pt-3">
        <button v-for="a in section.actions" :key="a.label" type="button" class="lib-btn" :disabled="busy" @click="runAction(a)"><span v-if="a.icon" class="material-symbols">{{ a.icon }}</span>{{ a.label }}</button>
      </div>
    </template>

    <div v-if="hasSave" class="sticky bottom-0 px-5 pt-6 pb-2" style="background: linear-gradient(to bottom, transparent, rgb(var(--color-bg)) 35%)">
      <button type="button" class="lib-btn primary block" :disabled="busy" @click="save">Save changes</button>
    </div>
  </librarian-page>
</template>

<script>
import { Clipboard } from '@capacitor/clipboard'
import { Dialog } from '@capacitor/dialog'
import { CHANNELS, CLIENT_FIELDS, SECTIONS } from '@/utils/librarianSettings'

export default {
  data() {
    return {
      cfg: null,
      busy: false,
      conn: { ...this.$store.state.librarian.config },
      connResult: null,
      clientSel: { torrent: 'none', usenet: 'none' },
      importKind: 'audio',
      importStatus: 'wanted',
      showKey: false,
      CHANNELS,
      PROV_TYPES: { prowlarr: 'Prowlarr', torznab: 'Torznab feed', newznab: 'Newznab feed' },
      PROV_USE: { both: 'Ebooks and audiobooks', ebook: 'Ebooks only', audio: 'Audiobooks only' },
      WANT: { ebook: 'Wants ebooks', audio: 'Wants audiobooks', both: 'Wants both formats' },
      CLIENT_OPTS: {
        torrent: [
          ['none', 'Nowhere'],
          ['realdebrid', 'Real-Debrid'],
          ['qbittorrent', 'qBittorrent'],
          ['transmission', 'Transmission'],
          ['blackhole', 'A blackhole folder']
        ],
        usenet: [
          ['none', 'Nowhere'],
          ['sabnzbd', 'SABnzbd'],
          ['nzbget', 'NZBGet'],
          ['blackhole', 'A blackhole folder']
        ]
      },
      notifyEvents: [
        ['on_snatch', 'When a download starts', 'toggle'],
        ['on_download', 'When a book is ready', 'toggle'],
        ['on_fail', 'When a download fails', 'toggle'],
        ['on_newbook', 'When a followed author has a new book', 'toggle']
      ]
    }
  },
  computed: {
    id() {
      return this.$route.params.section
    },
    section() {
      return SECTIONS.find((s) => s.id === this.id)
    },
    hasSave() {
      return this.cfg && ['downloads', 'notifications', 'security'].includes(this.id) ? true : !!(this.cfg && this.section && this.section.fields)
    },
    absAddress() {
      return this.$store.state.user.serverConnectionConfig?.address || ''
    },
    securityFields() {
      const s = this.cfg.server
      return [
        ['server.password', 'Password', 'password', s.password ? 'A password is set. Type a new one to change it, or clear the box to remove it.' : 'Optional while only this phone can connect. Set one before you let other devices in.'],
        ['_lan', 'Let other devices connect', 'toggle', 'Listens on every network, including Tailscale, so a laptop or tablet can use it too. Takes effect after pl restart.'],
        ['server.port', 'Port', 'number', 'Takes effect after pl restart.'],
        ['server.allowed_hosts', 'Extra host names', 'text', 'Only needed if you open it by a name other than an IP address, a .ts.net name or localhost.'],
        ['opds.enabled', 'Catalog for reading apps (OPDS)', 'toggle', `Add ${this.$librarian.baseUrl}/opds in apps like KOReader or Moon+ Reader to browse your ebooks.`]
      ]
    },
    securityValues() {
      return { ...this.cfg, _lan: this.cfg.server.host === '0.0.0.0' }
    },
    aboutRows() {
      const m = this.cfg.meta
      return [
        ['Version', m.version],
        ['Running on', m.termux ? 'Termux on Android, Python ' + m.python : 'Python ' + m.python],
        ['Server address', this.$librarian.baseUrl],
        ['Settings, database and logs', m.data_dir],
        ['Audiobook folder', this.cfg.library.audio_dir],
        ['Ebook folder', this.cfg.library.ebook_dir],
        ['RAR and 7z downloads', m.archive_tool ? 'Unpacked with ' + m.archive_tool : 'No extractor found. In Termux run: pkg install 7zip'],
        ['Phone notifications', m.android_notify ? 'Available' : 'Needs the Termux:API app and pkg install termux-api']
      ]
    }
  },
  methods: {
    async load() {
      if (this.id === 'connection') return
      if (!this.section) return this.$router.replace('/librarian/settings')
      try {
        this.cfg = await this.$librarian.get('/api/config')
        this.clientSel = { torrent: this.cfg.clients.torrent, usenet: this.cfg.clients.usenet }
      } catch (error) {
        if (!error.offline && !error.login) this.$toast.error(error.message)
      }
    },
    getRef(name) {
      const r = this.$refs[name]
      return Array.isArray(r) ? r[0] : r
    },
    clientFields(proto) {
      const name = this.clientSel[proto]
      if (name === 'blackhole') return [[proto + '_dir', proto === 'torrent' ? 'Folder for .torrent and .magnet files' : 'Folder for .nzb files', 'text', 'Something else has to watch this folder and download what lands in it.']]
      return CLIENT_FIELDS[name] || []
    },
    clientPatch(proto) {
      const f = this.getRef('client-' + proto)
      return f ? f.patch() : {}
    },
    buildPatch() {
      if (this.id === 'downloads') {
        const patch = { clients: { torrent: this.clientSel.torrent, usenet: this.clientSel.usenet, stall_hours: this.getRef('stall').patch().clients.stall_hours } }
        for (const proto of ['torrent', 'usenet']) {
          const name = this.clientSel[proto]
          if (name === 'none') continue
          patch.clients[name] = { ...(patch.clients[name] || {}), ...this.clientPatch(proto) }
        }
        return patch
      }
      if (this.id === 'notifications') {
        const p = this.getRef('events').patch()
        CHANNELS.forEach(([id]) => (p[id] = this.getRef('ch-' + id).patch()))
        return { notifications: p }
      }
      if (this.id === 'security') {
        const v = this.getRef('security').patch()
        return { server: { port: v.server.port || 5300, host: v._lan ? '0.0.0.0' : '127.0.0.1', allowed_hosts: v.server.allowed_hosts, password: v.server.password }, opds: { enabled: v.opds.enabled } }
      }
      return this.getRef('form').patch()
    },
    async save() {
      this.busy = true
      try {
        this.cfg = await this.$librarian.put('/api/config', this.buildPatch())
        this.$toast.success(this.id === 'security' ? 'Saved. Restart Pocket Librarian if you changed the address or port.' : 'Settings saved')
        this.$librarian.changed({ config: true })
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    async runAction(a) {
      this.busy = true
      try {
        let body = {}
        if (a.withConfig) body = { config: { ...this.cfg[a.withConfig], ...(this.getRef('form').patch()[a.withConfig] || {}) } }
        const r = await this.$librarian.post(a.path, body)
        this.$toast.success(a.msg(r))
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    fillAbsAddress() {
      const form = this.getRef('form')
      this.$set(form.vals, 'audiobookshelf.url', this.absAddress)
    },
    async testClient(proto) {
      this.busy = true
      try {
        const name = this.clientSel[proto]
        const r = await this.$librarian.post('/api/test/client', { type: name, protocol: proto, config: { ...(this.cfg.clients[name] || {}), ...this.clientPatch(proto) } })
        this.$toast.success(r.message)
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    async testNotify(channel) {
      this.busy = true
      try {
        const r = await this.$librarian.post('/api/test/notify', { channel, config: { ...this.cfg.notifications[channel], ...this.getRef('ch-' + channel).patch() } })
        this.$toast.success(r.message)
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    editProvider(p, i) {
      this.$librarian.openSheet({ type: 'provider', provider: p, index: i, providers: this.cfg.providers })
    },
    editWishlist(w, i) {
      this.$librarian.openSheet({ type: 'wishlist', wishlist: w, index: i, wishlists: this.cfg.wishlists })
    },
    async importCsv() {
      const f = this.$refs.csv && this.$refs.csv.files[0]
      if (!f) return this.$toast.error('Choose a CSV file first.')
      this.busy = true
      try {
        const k = this.importKind
        const r = await this.$librarian.post('/api/import/csv', { csv: await f.text(), kinds: k === 'both' ? ['ebook', 'audio'] : [k], status: this.importStatus })
        this.$toast.success(r.message)
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    async copyKey() {
      await Clipboard.write({ string: this.cfg.server.api_key })
      this.$toast.success('Key copied')
    },
    async newKey() {
      const { value } = await Dialog.confirm({ title: 'New API key', message: 'Make a new key? Anything using the old one stops working.' })
      if (!value) return
      this.busy = true
      try {
        const k = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('')
        this.cfg = await this.$librarian.put('/api/config', { server: { api_key: k } })
        // Keep this app connected if it was using the old key
        if (this.$store.state.librarian.config.apiKey) await this.$librarian.saveConfig({ ...this.$store.state.librarian.config, apiKey: k })
        this.$toast.success('New key saved')
      } catch (error) {
        this.$toast.error(error.message)
      } finally {
        this.busy = false
      }
    },
    async saveConnection() {
      this.busy = true
      this.connResult = null
      try {
        await this.$librarian.saveConfig(this.conn)
        this.conn = { ...this.$store.state.librarian.config }
        const p = await this.$librarian.ping()
        if (!p.online) this.connResult = { ok: false, text: 'Saved, but nothing answered at that address.' }
        else if (p.auth && !p.authed) this.connResult = { ok: false, text: `Connected to Pocket Librarian ${p.version}, but it has a password. Add its API key.` }
        else {
          this.connResult = { ok: true, text: `Connected to Pocket Librarian ${p.version}.` }
          this.$store.commit('librarian/setNeedsKey', false)
          this.$librarian.loadStatus().catch(() => {})
        }
      } finally {
        this.busy = false
      }
    },
    async startServer() {
      this.busy = true
      try {
        await this.$librarian.startServer()
        this.connResult = { ok: true, text: 'Pocket Librarian is running.' }
      } catch (error) {
        this.connResult = { ok: false, text: error.message }
      } finally {
        this.busy = false
      }
    }
  },
  mounted() {
    this.load()
  }
}
</script>
