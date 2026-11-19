'use strict';

function objectOrEmpty(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function backupStableKey(row) {
  if (!row || typeof row !== 'object') return String(row);
  for (const key of ['id', 'username', 'email', 'reference', 'orderId', 'order_id', 'legacyImportKey', 'eventId', 'refundEventId']) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) return key + ':' + String(row[key]);
  }
  return JSON.stringify(row);
}

// Existing production values always win. Missing keys from the backup are added recursively.
function mergeBackupPreservingExisting(current, incoming) {
  if (incoming === undefined) return current;
  if (current === undefined || current === null) return clone(incoming);
  if (Array.isArray(current) && Array.isArray(incoming)) {
    const out = current.map(value => value && typeof value === 'object' ? clone(value) : value);
    const index = new Map();
    out.forEach((row, i) => index.set(backupStableKey(row), i));
    for (const row of incoming) {
      const key = backupStableKey(row);
      if (index.has(key)) {
        const i = index.get(key);
        if (out[i] && row && typeof out[i] === 'object' && typeof row === 'object' && !Array.isArray(out[i]) && !Array.isArray(row)) {
          out[i] = mergeBackupPreservingExisting(out[i], row);
        }
      } else {
        out.push(row && typeof row === 'object' ? clone(row) : row);
        index.set(key, out.length - 1);
      }
    }
    return out;
  }
  if (current && incoming && typeof current === 'object' && typeof incoming === 'object' && !Array.isArray(current) && !Array.isArray(incoming)) {
    const out = clone(incoming);
    for (const [key, value] of Object.entries(current)) {
      out[key] = Object.prototype.hasOwnProperty.call(incoming, key)
        ? mergeBackupPreservingExisting(value, incoming[key])
        : clone(value);
    }
    return out;
  }
  return current;
}

function count(value) {
  return Object.keys(objectOrEmpty(value)).length;
}

function labelKey(value) {
  return String(value ?? '').trim().toLocaleLowerCase('ar').normalize('NFKC').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[\s._-]+/g, '');
}

function rowGroups(row) {
  const values = [];
  if (Array.isArray(row?.groups)) values.push(...row.groups);
  if (Array.isArray(row?.categories)) values.push(...row.categories);
  if (row?.category) values.push(row.category);
  const seen = new Set();
  return values.map(value => String(value ?? '').trim()).filter(value => {
    const key = labelKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pushUnique(list, value) {
  const text = String(value ?? '').trim();
  const key = labelKey(text);
  if (!text || !key || list.some(existing => labelKey(existing) === key)) return false;
  list.push(text);
  return true;
}

function hasOrderEvidence(orderValue) {
  const order = objectOrEmpty(orderValue);
  const services = objectOrEmpty(order.services);
  return (Array.isArray(order.categories) && order.categories.length > 0)
    || Object.values(services).some(rows => Array.isArray(rows) && rows.length > 0);
}

/**
 * Builds a fail-safe Firebase catalog patch for a full database restore.
 * Priority is: live Firebase, backup Firebase, current Railway cache, backup Railway cache.
 * The resulting service catalog is written to Firebase and read back before success is reported.
 */
function buildCatalogRestoreState(currentFirebase, backup, now = Date.now(), currentLocalFiles = {}) {
  const current = objectOrEmpty(currentFirebase);
  const backupRoot = objectOrEmpty(backup?.firebaseData);
  const backupFiles = objectOrEmpty(backup?.serverData);
  const liveFiles = objectOrEmpty(currentLocalFiles);
  const localCatalogSettings = objectOrEmpty(backupFiles['catalog_settings.json']);
  const liveCatalogSettings = objectOrEmpty(liveFiles['catalog_settings.json']);
  const currentSettings = objectOrEmpty(current.settings);
  const backupSettings = objectOrEmpty(backupRoot.settings);

  const backupFirebaseServices = objectOrEmpty(backupRoot.services);
  const backupLocalServices = objectOrEmpty(backupFiles['services.json']);
  const liveLocalServices = objectOrEmpty(liveFiles['services.json']);
  const localServices = objectOrEmpty(mergeBackupPreservingExisting(liveLocalServices, backupLocalServices));
  const sourceServices = objectOrEmpty(mergeBackupPreservingExisting(backupFirebaseServices, localServices));
  const currentServices = objectOrEmpty(current.services);
  const mergedServices = objectOrEmpty(mergeBackupPreservingExisting(currentServices, sourceServices));

  const backupFirebaseMeta = objectOrEmpty(backupRoot.categoryMeta);
  const backupLocalMeta = objectOrEmpty(backupFiles['category_meta.json']);
  const liveLocalMeta = objectOrEmpty(liveFiles['category_meta.json']);
  const localMeta = objectOrEmpty(mergeBackupPreservingExisting(liveLocalMeta, backupLocalMeta));
  const sourceMeta = objectOrEmpty(mergeBackupPreservingExisting(backupFirebaseMeta, localMeta));
  const currentMeta = objectOrEmpty(current.categoryMeta);
  const mergedMeta = objectOrEmpty(mergeBackupPreservingExisting(currentMeta, sourceMeta));

  const backupFirebaseProviderServices = objectOrEmpty(backupRoot.providerServices);
  const backupLocalProviderServices = objectOrEmpty(backupFiles['provider_services.json']);
  const liveLocalProviderServices = objectOrEmpty(liveFiles['provider_services.json']);
  const localProviderServices = objectOrEmpty(mergeBackupPreservingExisting(liveLocalProviderServices, backupLocalProviderServices));
  const sourceProviderServices = objectOrEmpty(mergeBackupPreservingExisting(backupFirebaseProviderServices, localProviderServices));
  const mergedProviderServices = objectOrEmpty(mergeBackupPreservingExisting(objectOrEmpty(current.providerServices), sourceProviderServices));

  const sourceFirebaseOrder = objectOrEmpty(backupSettings.catalogOrder);
  const sourceBackupLocalOrder = objectOrEmpty(localCatalogSettings.catalogOrder);
  const sourceLiveLocalOrder = objectOrEmpty(liveCatalogSettings.catalogOrder);
  const localOrder = objectOrEmpty(mergeBackupPreservingExisting(sourceLiveLocalOrder, sourceBackupLocalOrder));
  const sourceOrder = objectOrEmpty(mergeBackupPreservingExisting(sourceFirebaseOrder, localOrder));
  const currentOrder = objectOrEmpty(currentSettings.catalogOrder);
  const order = objectOrEmpty(mergeBackupPreservingExisting(currentOrder, sourceOrder));
  order.categories = Array.isArray(order.categories) ? order.categories.slice() : [];
  order.services = objectOrEmpty(order.services);
  order.platforms = objectOrEmpty(order.platforms);

  // Reconnect restored service rows to their sections without disturbing existing manual order.
  for (const [metaKey, metaValue] of Object.entries(mergedMeta)) {
    if (!metaValue || typeof metaValue !== 'object' || Array.isArray(metaValue)) continue;
    const name = String(metaValue.name || metaKey).trim();
    pushUnique(order.categories, name);
    const linked = Object.keys(mergedServices).filter(key => rowGroups(mergedServices[key]).some(group => labelKey(group) === labelKey(name)));
    const previous = Array.isArray(metaValue.serviceKeys) ? metaValue.serviceKeys.map(String) : [];
    const serviceKeys = [...new Set([...previous, ...linked])];
    if (serviceKeys.length !== previous.length) mergedMeta[metaKey] = { ...metaValue, serviceKeys };
    const bucket = metaKey || name.replace(/[^a-zA-Z0-9_\-\u0600-\u06ff]+/g, '_');
    const priorOrder = Array.isArray(order.services[bucket]) ? order.services[bucket].map(String) : [];
    order.services[bucket] = [...new Set([...priorOrder, ...linked])];
  }

  const allOrder = Array.isArray(order.services.__all__) ? order.services.__all__.map(String) : [];
  order.services.__all__ = [...new Set([...allOrder, ...Object.keys(mergedServices)])];
  for (const row of Object.values(mergedServices)) {
    for (const group of rowGroups(row)) pushUnique(order.categories, group);
  }

  const backupVersion = backupSettings.svcsVersion ?? localCatalogSettings.firebaseSvcsVersion ?? localCatalogSettings.svcsVersion;
  const liveLocalVersion = liveCatalogSettings.firebaseSvcsVersion ?? liveCatalogSettings.svcsVersion;
  const currentVersion = currentSettings.svcsVersion;
  const backupServicesCount = count(sourceServices);
  const backupFirebaseServicesCount = count(backupFirebaseServices);
  const backupLocalServicesCount = count(backupLocalServices);
  const liveLocalServicesCount = count(liveLocalServices);
  const currentServicesCount = count(currentServices);
  const mergedServicesCount = count(mergedServices);
  const backupSectionsCount = count(sourceMeta);
  const currentSectionsCount = count(currentMeta);
  const currentOrderHasEvidence = hasOrderEvidence(currentOrder);
  const backupOrderHasEvidence = hasOrderEvidence(sourceOrder);
  const currentCatalogEvidence = currentSectionsCount > 0 || count(current.providerServices) > 0 || currentOrderHasEvidence || (currentVersion !== undefined && currentVersion !== null && String(currentVersion).trim() !== '');
  const backupCatalogEvidence = backupServicesCount > 0 || backupSectionsCount > 0 || count(sourceProviderServices) > 0 || backupOrderHasEvidence || (backupVersion !== undefined && backupVersion !== null && String(backupVersion).trim() !== '') || (liveLocalVersion !== undefined && liveLocalVersion !== null && String(liveLocalVersion).trim() !== '');
  const catalogMissing = currentServicesCount === 0 && backupServicesCount === 0 && (currentCatalogEvidence || backupCatalogEvidence);

  const newlyRecoveredServiceCount = Math.max(0, mergedServicesCount - currentServicesCount);
  const mergedSettings = objectOrEmpty(mergeBackupPreservingExisting(currentSettings, backupSettings));
  if (backupCatalogEvidence || currentCatalogEvidence) mergedSettings.catalogOrder = order;
  if (newlyRecoveredServiceCount > 0) mergedSettings.svcsVersion = String(now);
  else if ((mergedSettings.svcsVersion === undefined || mergedSettings.svcsVersion === null || String(mergedSettings.svcsVersion).trim() === '') && backupVersion !== undefined && backupVersion !== null) {
    mergedSettings.svcsVersion = String(backupVersion);
  } else if ((mergedSettings.svcsVersion === undefined || mergedSettings.svcsVersion === null || String(mergedSettings.svcsVersion).trim() === '') && liveLocalVersion !== undefined && liveLocalVersion !== null) {
    mergedSettings.svcsVersion = String(liveLocalVersion);
  }

  const shouldApplyCatalog = backupCatalogEvidence || currentCatalogEvidence;
  const rootPatch = {};
  if (shouldApplyCatalog) {
    rootPatch.services = mergedServices;
    rootPatch.categoryMeta = mergedMeta;
    rootPatch.providerServices = mergedProviderServices;
    rootPatch.settings = mergedSettings;
  }

  return {
    rootPatch,
    catalogMissing,
    shouldApplyCatalog,
    recoveredFromLocalCache: (backupLocalServicesCount > 0 && backupFirebaseServicesCount === 0) || (liveLocalServicesCount > 0 && currentServicesCount === 0 && backupFirebaseServicesCount === 0),
    backupServicesCount,
    backupFirebaseServicesCount,
    backupLocalServicesCount,
    liveLocalServicesCount,
    currentServicesCount,
    mergedServicesCount,
    backupSectionsCount,
    currentSectionsCount,
    mergedSectionsCount: count(mergedMeta),
    recoveredServiceCount: newlyRecoveredServiceCount,
    catalogCategoryCount: order.categories.length,
    hasBackupServiceRows: backupServicesCount > 0,
    currentCatalogEvidence,
    backupCatalogEvidence
  };
}

/**
 * Builds a catalog snapshot exclusively from a trusted full backup.
 * Unlike the normal merge helper, this intentionally does not read the live
 * Firebase catalog or the current Railway cache: it is used only by an explicit
 * administrator restore operation to roll back a catalog that may have been
 * corrupted after the backup was created. The backup's Firebase nodes take
 * precedence over the backup's local mirrors; the backup mirrors only fill gaps.
 */
function buildCatalogSnapshotRestoreState(backup, now = Date.now()) {
  const state = buildCatalogRestoreState({}, backup, now, {});
  const source = state.backupFirebaseServicesCount > 0
    ? 'firebase-backup'
    : state.backupLocalServicesCount > 0
      ? 'backup-server-files'
      : 'missing';
  return {
    ...state,
    catalogMissing: state.mergedServicesCount === 0,
    snapshotRestore: true,
    snapshotSource: source
  };
}

module.exports = {
  mergeBackupPreservingExisting,
  buildCatalogRestoreState,
  buildCatalogSnapshotRestoreState
};
