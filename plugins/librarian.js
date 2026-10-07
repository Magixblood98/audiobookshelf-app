import { CapacitorHttp } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { Browser } from '@capacitor/browser'
import { TermuxRunner } from '@/plugins/capacitor/TermuxRunner'
import { cleanTitle, normalizeTitle, titlesMatch } from '@/utils/seriesRequests'

/**
 * Librarian: the in-app front end for a Pocket Librarian server.
 * Pocket Librarian keeps doing the background work (scheduled searches, Real-Debrid, renaming files,
 * Audiobookshelf scans); this plugin talks to its JSON API natively so there are no CORS issues.
 */

const CONFIG_KEY = 'librarianConfig'
const DEFAULT_URL = 'http://127.0.0.1:5300'
const TERMUX_PL = '/data/data/com.termux/files/usr/bin/pl'

export const KIND = { ebook: 'Ebook', audio: 'Audiobook' }
export const STATUS_TEXT = { skipped: 'Not wanted', wanted: 'Wanted', snatched: 'Downloading', have: 'In library', ignored: 'Ignored' }
export const DL_TEXT = { sent: 'Sent to the client', downloading: 'Downloading', fetching: 'Copying to this device', processing: 'Organizing files', done: 'Done', failed: 'Failed', blackhole: 'Left in the blackhole folder' }
export const ACTIVE = ['sent', 'downloading', 'fetching', 'processing']
export const RANK = { have: 4, snatched: 3, wanted: 2, skipped: 1, ignored: 0 }
export const MON = { ebook: 'ebooks', audio: 'audiobooks', both: 'ebooks and audiobooks' }
export const CLOTH = ['#2D5E52', '#3B4E6B', '#6B3B3B', '#4E5D2C', '#5B4A6E', '#2F4F5F', '#6A5230']

export class LibrarianError extends Error {
  constructor(message, { status = 0, offline = false, login = false } = {}) {
    super(message)
    this.status = status
    this.offline = offline
    this.login = login
  }
}

export const bestStatus = (b) => [b.ebook_status, b.audio_status].sort((x, y) => RANK[y] - RANK[x])[0]

export function hashStr(s) {
  let x = 2166136261
  for (const c of String(s)) {
    x ^= c.codePointAt(0)
    x = Math.imul(x, 16777619)
  }
  return x >>> 0
}

export function initials(s) {
  const w = String(s || '')
    .replace(/^(the|a|an)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
  return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase()
}

export function ago(t) {
  if (!t) return 'never'
  const s = Math.max(0, Date.now() / 1000 - t)
  if (s < 50) return 'just now'
  if (s < 3600) return Math.round(s / 60) + ' min ago'
  if (s < 86400) return Math.round(s / 3600) + ' h ago'
  const d = Math.round(s / 86400)
  return d < 31 ? d + (d === 1 ? ' day ago' : ' days ago') : new Date(t * 1000).toLocaleDateString()
}

export function until(t) {
  const s = t - Date.now() / 1000
  if (s < 90) return 'soon'
  if (s < 3600) return 'in ' + Math.round(s / 60) + ' min'
  if (s < 86400) return 'in ' + Math.round(s / 3600) + ' h'
  return 'in ' + Math.round(s / 86400) + ' days'
}

export const every = (iv) => (!iv ? 'Off' : iv < 120 ? `Every ${Math.round(iv)} seconds` : iv < 7200 ? `Every ${Math.round(iv / 60)} minutes` : `Every ${+(iv / 3600).toFixed(1)} hours`)
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
export const joinList = (a) => (a.length < 2 ? a[0] || '' : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1])

export function pathLabel(p) {
  if (!p) return ''
  if (p.startsWith('rd://')) return 'Kept in Real-Debrid as ' + p.slice(5)
  if (p.startsWith('remote:')) return 'On the download client at ' + p.slice(7)
  if (p.startsWith('abs://')) return 'In Audiobookshelf'
  return p
}

class Librarian {
  constructor({ store }) {
    this.store = store
    this.config = { url: DEFAULT_URL, apiKey: '' }
    this.loaded = this.loadConfig()
  }

  async loadConfig() {
    try {
      const obj = (await Preferences.get({ key: CONFIG_KEY })) || {}
      if (obj.value) this.config = { url: DEFAULT_URL, apiKey: '', ...JSON.parse(obj.value) }
    } catch (error) {
      console.error('[Librarian] Failed to load config', error)
    }
    this.store.commit('librarian/setConfig', { ...this.config })
    return this.config
  }

  async saveConfig(config) {
    this.config = { url: (config.url || DEFAULT_URL).trim().replace(/\/+$/, ''), apiKey: (config.apiKey || '').trim() }
    await Preferences.set({ key: CONFIG_KEY, value: JSON.stringify(this.config) })
    this.store.commit('librarian/setConfig', { ...this.config })
    return this.config
  }

  // Injected by init.client.js; looked up lazily so plugin order doesn't matter
  get eventBus() {
    return this.store.$eventBus
  }

  get baseUrl() {
    return (this.config.url || DEFAULT_URL).replace(/\/+$/, '')
  }

  get isLocal() {
    return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(this.baseUrl)
  }

  withKey(url) {
    if (!this.config.apiKey) return url
    return url + (url.includes('?') ? '&' : '?') + 'apikey=' + encodeURIComponent(this.config.apiKey)
  }

  /** Server-relative paths (local covers, files) need the server address and the API key */
  resolve(path) {
    if (!path) return ''
    if (/^https?:/i.test(path)) return path
    return this.withKey(this.baseUrl + path)
  }

  coverUrl(b) {
    return this.resolve(b?.cover || b?.cover_url || '')
  }

  async api(path, { method = 'GET', body, timeout = 120000 } = {}) {
    await this.loaded
    const headers = {}
    if (this.config.apiKey) headers['X-Api-Key'] = this.config.apiKey
    let data
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json'
      data = body || {}
    }
    let res
    try {
      res = await CapacitorHttp.request({ method, url: this.baseUrl + path, headers, data, connectTimeout: 8000, readTimeout: timeout })
    } catch (error) {
      console.error('[Librarian] Request failed', method, path, error)
      this.store.commit('librarian/setOnline', false)
      throw new LibrarianError('Pocket Librarian isn’t answering.', { offline: true })
    }
    let out = res.data
    if (typeof out === 'string') {
      try {
        out = JSON.parse(out)
      } catch {
        // not JSON
      }
    }
    if (!res.status) {
      this.store.commit('librarian/setOnline', false)
      throw new LibrarianError('Pocket Librarian isn’t answering.', { offline: true })
    }
    this.store.commit('librarian/setOnline', true)
    if (res.status === 401 && out?.login) {
      this.store.commit('librarian/setNeedsKey', true)
      throw new LibrarianError('Pocket Librarian has a password. Add its API key in Librarian settings.', { status: 401, login: true })
    }
    if (res.status >= 400) {
      throw new LibrarianError(out?.error || `Request failed (HTTP ${res.status})`, { status: res.status })
    }
    this.store.commit('librarian/setNeedsKey', false)
    return out
  }

  get(path) {
    return this.api(path)
  }
  post(path, body) {
    return this.api(path, { method: 'POST', body })
  }
  patch(path, body) {
    return this.api(path, { method: 'PATCH', body })
  }
  put(path, body) {
    return this.api(path, { method: 'PUT', body })
  }
  delete(path) {
    return this.api(path, { method: 'DELETE' })
  }

  async ping() {
    try {
      const p = await this.api('/api/ping')
      return { online: true, auth: p.auth, authed: p.authed, version: p.version }
    } catch (error) {
      return { online: false, error }
    }
  }

  async loadStatus() {
    const status = await this.api('/api/status')
    this.store.commit('librarian/setStatus', status)
    return status
  }

  /** Something changed (a book was wanted, an author followed...): pages refresh themselves */
  changed(what = {}) {
    this.eventBus.$emit('librarian-changed', what)
    this.loadStatus().catch(() => {})
  }

  openBook(id) {
    this.eventBus.$emit('librarian-sheet', { type: 'book', id })
  }
  openAddBook(book) {
    this.eventBus.$emit('librarian-sheet', { type: 'addBook', book })
  }
  openAddAuthor(author) {
    this.eventBus.$emit('librarian-sheet', { type: 'addAuthor', author })
  }
  openSheet(payload) {
    this.eventBus.$emit('librarian-sheet', payload)
  }

  /**
   * Show an Audiobookshelf book in Librarian: its book sheet when Librarian tracks it,
   * otherwise the Add sheet for the closest Open Library match (to want the ebook, say).
   */
  async findBook(title, authorName) {
    const author = (authorName || '').split(/,|&| and /)[0].trim()
    const surname = normalizeTitle(author).split(' ').pop() || ''
    const byAuthor = (name) => !surname || normalizeTitle(name).split(' ').includes(surname)
    const tracked = await this.get(`/api/books?status=all&q=${encodeURIComponent(cleanTitle(title))}&limit=50`)
    const hit = (tracked.books || []).find((b) => titlesMatch(b.title, title) && byAuthor(b.author_name))
    if (hit) return this.openBook(hit.id)
    const found = await this.get('/api/lookup/books?q=' + encodeURIComponent(`${cleanTitle(title)} ${author}`))
    const match = (found.results || []).find((r) => titlesMatch(r.title, title) && byAuthor(r.author_name)) || (found.results || [])[0]
    if (!match) throw new LibrarianError('Open Library doesn’t know this book.')
    if (match.book_id) return this.openBook(match.book_id)
    this.openAddBook(match)
  }

  /** Open a server file (ebook download, CSV export) in the browser, which handles saving it */
  async openFile(path) {
    await Browser.open({ url: this.resolve(path) })
  }

  /** Ask Termux to run `pl start`. Needs Termux with allow-external-apps=true and the RUN_COMMAND permission. */
  async startServer() {
    if (!this.isLocal) throw new LibrarianError('Pocket Librarian runs on another device. Start it there.')
    const { installed } = await TermuxRunner.isInstalled()
    if (!installed) throw new LibrarianError('Termux isn’t installed on this phone.')
    await TermuxRunner.run({ path: TERMUX_PL, arguments: ['start'], workdir: '/data/data/com.termux/files/home' })
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      const p = await this.ping()
      if (p.online) {
        this.loadStatus().catch(() => {})
        return true
      }
    }
    throw new LibrarianError('Asked Termux to start it, but it hasn’t answered yet. Open Termux and run pl start to see what’s wrong.')
  }
}

export default function ({ store }, inject) {
  inject('librarian', new Librarian({ store }))
}
