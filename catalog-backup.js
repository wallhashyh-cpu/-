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
  return String(value ?? '').replace(/[\u200B-\u200F\uFEFF]/g, '').trim().toLocaleLowerCase('ar').normalize('NFKC')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '').replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\s._\-–—]+/gu, '').replace(/[^\p{L}\p{N}]/gu, '');
}

function objectEntriesSafe(value) {
  return Object.entries(objectOrEmpty(value));
}

function normalizeDeletionLedger(value) {
  const ledger = {};
  for (const [key, row] of objectEntriesSafe(value)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const normalizedName = labelKey(row.normalizedName || row.name || key);
    if (!normalizedName) continue;
    ledger[key] = {
      ...clone(row),
      name: String(row.name || normalizedName),
      normalizedName,
      metaKeys: [...new Set((Array.isArray(row.metaKeys) ? row.metaKeys : []).map(String).filter(Boolean))],
      deletedServiceKeys: [...new Set((Array.isArray(row.deletedServiceKeys) ? row.deletedServiceKeys : []).map(String).filter(Boolean))]
    };
  }
  return ledger;
}

function mergeDeletionLedgers(...values) {
  const merged = {};
  for (const value of values) {
    for (const [key, row] of Object.entries(normalizeDeletionLedger(value))) {
      const previous = merged[key] || {};
      merged[key] = {
        ...previous,
        ...row,
        metaKeys: [...new Set([...(previous.metaKeys || []), ...(row.metaKeys || [])])],
        deletedServiceKeys: [...new Set([...(previous.deletedServiceKeys || []), ...(row.deletedServiceKeys || [])])]
      };
    }
  }
  return merged;
}

function filterCatalogByDeletionLedger({ services, freeServices, manualServices, categoryMeta, providerServices, settings }, deletionLedger) {
  const ledger = normalizeDeletionLedger(deletionLedger);
  const entries = Object.values(ledger);
  const settingsInput = objectOrEmpty(settings);
  const freeLedger = objectOrEmpty(settingsInput.catalogDeletedFreeServices);
  const deletedFreeKeys = new Set();
  const deletedFreeIdentities = new Set();
  for (const [key, row] of Object.entries(freeLedger)) {
    if (!row || typeof row !== 'object' || row.deleted === false) continue;
    deletedFreeKeys.add(String(key));
    for (const identity of [key, ...(Array.isArray(row.identityKeys) ? row.identityKeys : [])]) {
      const text = String(identity ?? '').trim();
      if (text) deletedFreeIdentities.add(text);
    }
  }
  const deletedNames = new Set(entries.map(row => row.normalizedName).filter(Boolean));
  const deletedMetaKeys = new Set(entries.flatMap(row => row.metaKeys || []));
  const deletedServiceKeys = new Set(entries.flatMap(row => row.deletedServiceKeys || []));
  const filterServiceStore = (source, additionalKeys = new Set(), additionalIdentities = new Set()) => {
    const next = { ...objectOrEmpty(source) };
    let removed = 0;
    for (const key of Object.keys(next)) {
      const row = next[key];
      const ids = [key, row?.fbKey, row?.key, row?.id, row?.siteServiceId, row?.internalServiceId, row?.serviceId, row?.providerServiceId, row?.smmpartyId]
        .map(value => String(value ?? '').trim()).filter(Boolean);
      if (deletedServiceKeys.has(String(key)) || ids.some(id => additionalKeys.has(id) || additionalIdentities.has(id))) {
        delete next[key]; removed++; continue;
      }
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const groups = rowGroups(row);
      const remaining = groups.filter(group => !deletedNames.has(labelKey(group)));
      if (remaining.length !== groups.length) next[key] = { ...row, groups: remaining, categories: remaining, category: remaining[0] || '', section: remaining[0] || '', sectionName: remaining[0] || '' };
    }
    return { next, removed };
  };
  const standardResult = filterServiceStore(services);
  const freeResult = filterServiceStore(freeServices, deletedFreeKeys, deletedFreeIdentities);
  const manualResult = filterServiceStore(manualServices);
  const nextServices = standardResult.next;
  const nextFreeServices = freeResult.next;
  const nextManualServices = manualResult.next;
  const nextMeta = { ...objectOrEmpty(categoryMeta) };
  let removedSections = 0;
  const remainingServiceIds = new Set([...Object.keys(nextServices), ...Object.keys(nextFreeServices), ...Object.keys(nextManualServices)]);
  for (const [key, row] of Object.entries(nextMeta)) {
    const nameKey = labelKey(row?.name || key);
    if (deletedMetaKeys.has(String(key)) || deletedNames.has(nameKey)) {
      delete nextMeta[key]; removedSections++; continue;
    }
    if (row && typeof row === 'object' && Array.isArray(row.serviceKeys)) {
      nextMeta[key] = { ...row, serviceKeys: [...new Set(row.serviceKeys.map(String))]
        .filter(serviceKey => !deletedServiceKeys.has(serviceKey) && !deletedFreeIdentities.has(serviceKey) && !deletedFreeKeys.has(serviceKey)
          && (remainingServiceIds.has(serviceKey) || (!deletedServiceKeys.size && !deletedFreeIdentities.size))) };
    }
  }
  const nextSettings = { ...settingsInput };
  const order = { ...objectOrEmpty(nextSettings.catalogOrder) };
  order.categories = (Array.isArray(order.categories) ? order.categories : []).filter(name => !deletedNames.has(labelKey(name)));
  const filterOrderMap = value => {
    const result = { ...objectOrEmpty(value) };
    for (const [bucket, ids] of Object.entries(result)) {
      if (deletedNames.has(labelKey(bucket)) || deletedMetaKeys.has(String(bucket))) { delete result[bucket]; continue; }
      if (Array.isArray(ids)) result[bucket] = ids.map(String).filter(id => !deletedServiceKeys.has(id) && !deletedFreeKeys.has(id) && !deletedFreeIdentities.has(id));
    }
    return result;
  };
  order.services = filterOrderMap(order.services);
  const platforms = { ...objectOrEmpty(order.platforms) };
  for (const [scope, raw] of Object.entries(platforms)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    platforms[scope] = {
      ...raw,
      categories: (Array.isArray(raw.categories) ? raw.categories : []).filter(name => !deletedNames.has(labelKey(name))),
      services: filterOrderMap(raw.services)
    };
  }
  order.platforms = platforms;
  nextSettings.catalogOrder = order;
  nextSettings.catalogDeletedSections = ledger;
  nextSettings.catalogDeletedFreeServices = freeLedger;
  return {
    services: nextServices, freeServices: nextFreeServices, manualServices: nextManualServices,
    categoryMeta: nextMeta, providerServices: objectOrEmpty(providerServices), settings: nextSettings,
    ledger, removedSections, removedServices: standardResult.removed + freeResult.removed + manualResult.removed,
    removedFreeServices: freeResult.removed
  };
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
function buildCatalogRestoreState(currentFirebase, backup, now = Date.now(), currentLocalFiles = {}, deletionLedgerOverride = null) {
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

  // A durable live deletion ledger must survive restoration from an older catalog snapshot.
  // Merge the current Firebase ledger with the explicitly supplied live ledger (if any).
  const effectiveDeletionLedger = mergeDeletionLedgers(
    currentSettings.catalogDeletedSections,
    deletionLedgerOverride,
    backupSettings.catalogDeletedSections,
    localCatalogSettings.catalogDeletedSections,
    liveCatalogSettings.catalogDeletedSections
  );
  const backupFirebaseFreeServices = objectOrEmpty(backupRoot.adminFreeServices);
  const backupLocalFreeServices = objectOrEmpty(backupFiles['free_services.json']);
  const sourceFreeServices = objectOrEmpty(mergeBackupPreservingExisting(backupFirebaseFreeServices, backupLocalFreeServices));
  const backupManualServices = objectOrEmpty(backupFiles['manual_services.json']);
  const filteredCatalog = filterCatalogByDeletionLedger({
    services: mergedServices,
    freeServices: sourceFreeServices,
    manualServices: backupManualServices,
    categoryMeta: mergedMeta,
    providerServices: mergedProviderServices,
    settings: currentSettings
  }, effectiveDeletionLedger);
  for (const key of Object.keys(mergedServices)) delete mergedServices[key];
  Object.assign(mergedServices, filteredCatalog.services);
  for (const key of Object.keys(mergedMeta)) delete mergedMeta[key];
  Object.assign(mergedMeta, filteredCatalog.categoryMeta);

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
  // Reapply the deletion ledger after all restore/order reconstruction so an older
  // categories[] list or platform bucket cannot reintroduce a deleted section.
  const finalFilteredCatalog = filterCatalogByDeletionLedger({
    services: mergedServices,
    freeServices: filteredCatalog.freeServices,
    manualServices: filteredCatalog.manualServices,
    categoryMeta: mergedMeta,
    providerServices: mergedProviderServices,
    settings: { catalogOrder: order, catalogDeletedFreeServices: filteredCatalog.settings.catalogDeletedFreeServices || currentSettings.catalogDeletedFreeServices || localCatalogSettings.catalogDeletedFreeServices || {} }
  }, effectiveDeletionLedger);
  order.categories = finalFilteredCatalog.settings.catalogOrder.categories;
  order.services = finalFilteredCatalog.settings.catalogOrder.services;
  order.platforms = finalFilteredCatalog.settings.catalogOrder.platforms;

  const backupVersion = backupSettings.svcsVersion ?? localCatalogSettings.firebaseSvcsVersion ?? localCatalogSettings.svcsVersion;
  const liveLocalVersion = liveCatalogSettings.firebaseSvcsVersion ?? liveCatalogSettings.svcsVersion;
  const currentVersion = currentSettings.svcsVersion;
  const backupServicesCount = count(sourceServices);
  const backupFirebaseServicesCount = count(backupFirebaseServices);
  const backupLocalServicesCount = count(backupLocalServices);
  const liveLocalServicesCount = count(liveLocalServices);
  const currentServicesCount = count(currentServices);
  const mergedServicesCount = count(mergedServices);
  const mergedFreeServicesCount = count(finalFilteredCatalog.freeServices);
  const mergedManualServicesCount = count(finalFilteredCatalog.manualServices);
  const mergedCatalogServicesCount = mergedServicesCount + mergedFreeServicesCount + mergedManualServicesCount;
  const backupFreeServicesCount = count(sourceFreeServices);
  const backupManualServicesCount = count(backupManualServices);
  const backupSectionsCount = count(sourceMeta);
  const currentSectionsCount = count(currentMeta);
  const currentOrderHasEvidence = hasOrderEvidence(currentOrder);
  const backupOrderHasEvidence = hasOrderEvidence(sourceOrder);
  const currentCatalogEvidence = currentSectionsCount > 0 || count(current.providerServices) > 0 || currentOrderHasEvidence || (currentVersion !== undefined && currentVersion !== null && String(currentVersion).trim() !== '');
  const backupCatalogEvidence = backupServicesCount > 0 || backupFreeServicesCount > 0 || backupManualServicesCount > 0 || backupSectionsCount > 0 || count(sourceProviderServices) > 0 || backupOrderHasEvidence || (backupVersion !== undefined && backupVersion !== null && String(backupVersion).trim() !== '') || (liveLocalVersion !== undefined && liveLocalVersion !== null && String(liveLocalVersion).trim() !== '');
  const catalogMissing = currentServicesCount === 0 && backupServicesCount === 0 && backupFreeServicesCount === 0 && backupManualServicesCount === 0 && (currentCatalogEvidence || backupCatalogEvidence);

  const newlyRecoveredServiceCount = Math.max(0, mergedCatalogServicesCount - (currentServicesCount + count(current.adminFreeServices)));
  const mergedSettings = objectOrEmpty(mergeBackupPreservingExisting(currentSettings, backupSettings));
  mergedSettings.catalogDeletedSections = effectiveDeletionLedger;
  mergedSettings.catalogDeletedFreeServices = finalFilteredCatalog.settings.catalogDeletedFreeServices || filteredCatalog.settings.catalogDeletedFreeServices || currentSettings.catalogDeletedFreeServices || localCatalogSettings.catalogDeletedFreeServices || {};
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
    rootPatch.adminFreeServices = finalFilteredCatalog.freeServices;
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
    mergedFreeServicesCount,
    mergedManualServicesCount,
    mergedCatalogServicesCount,
    removedByDeletionLedgerSections: filteredCatalog.removedSections,
    removedByDeletionLedgerServices: filteredCatalog.removedServices,
    localFilePatch: { 'free_services.json': finalFilteredCatalog.freeServices, 'manual_services.json': finalFilteredCatalog.manualServices },
    backupFreeServicesCount,
    backupManualServicesCount,
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
function buildCatalogSnapshotRestoreState(backup, now = Date.now(), deletionLedger = {}) {
  const state = buildCatalogRestoreState({}, backup, now, {}, deletionLedger);
  const source = state.backupFirebaseServicesCount > 0
    ? 'firebase-backup'
    : state.backupLocalServicesCount > 0 || state.backupFreeServicesCount > 0 || state.backupManualServicesCount > 0
      ? 'backup-server-files'
      : 'missing';
  return {
    ...state,
    catalogMissing: state.mergedCatalogServicesCount === 0,
    snapshotRestore: true,
    snapshotSource: source
  };
}

module.exports = {
  mergeBackupPreservingExisting,
  buildCatalogRestoreState,
  buildCatalogSnapshotRestoreState,
  labelKey,
  mergeDeletionLedgers,
  filterCatalogByDeletionLedger
};
