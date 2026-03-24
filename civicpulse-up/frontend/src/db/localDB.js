import { openDB } from 'idb'

let dbInstance = null

export async function getDB() {
  if (dbInstance) return dbInstance
  dbInstance = await openDB('civicpulse', 1, {
    upgrade(db) {
      // Sync queue for offline actions
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' })
      }
      // Draft store for in-progress forms
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' })
      }
      // Cache store
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' })
      }
    }
  })
  return dbInstance
}

export async function saveDraft(id, data) {
  const db = await getDB()
  await db.put('drafts', { id, data, updatedAt: new Date().toISOString() })
}

export async function getDraft(id) {
  const db = await getDB()
  return db.get('drafts', id)
}

export async function clearDraft(id) {
  const db = await getDB()
  await db.delete('drafts', id)
}

export async function getSyncQueue() {
  const db = await getDB()
  return db.getAll('sync_queue')
}

export async function removeSyncItem(id) {
  const db = await getDB()
  await db.delete('sync_queue', id)
}
