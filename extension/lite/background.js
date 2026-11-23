'use strict';

importScripts('site-patterns.js');

const TAG = '[TNG-Lite]';
const SP = globalThis.TNGSitePatterns;
const STORAGE_KEY = 'tngSitePatterns';
const LEGACY_STORAGE_KEY = 'tngSites';
const RULE_ID = 900011;
const VIS_SCRIPT_ID = 'tng-lite-visibility';

const hiddenTabs = new Set();
let managedPatterns = [];
let firewallWantedRevision = 0;
let firewallAppliedRevision = 0;
let firewallRunner = null;
const firewallWaiters = [];

let reconfigureChain = Promise.resolve();
let initializePromise = null;
let initialized = false;

function isManagedUrl(raw) {
    return managedPatterns.some(pattern => SP.matchesUrl(pattern, raw));
}

async function migrateLegacyStorage() {
    const data = await chrome.storage.local.get([
        STORAGE_KEY,
        LEGACY_STORAGE_KEY
    ]);

    if (Array.isArray(data[STORAGE_KEY])) {
        return;
    }

    if (!Array.isArray(data[LEGACY_STORAGE_KEY])) {
        return;
    }

    const migrated = SP.normalizeList(data[LEGACY_STORAGE_KEY])
        .map(pattern => pattern.canonical);

    await chrome.storage.local.set({
        [STORAGE_KEY]: migrated
    });
    await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
}

async function readConfiguredPatterns() {
    await migrateLegacyStorage();

    const data = await chrome.storage.local.get(STORAGE_KEY);
    const patterns = SP.normalizeList(data[STORAGE_KEY]);
    const result = [];

    for (const pattern of patterns) {
        const origins = SP.chromeMatches(pattern);
        const permitted = await chrome.permissions.contains({ origins });
        if (permitted) {
            result.push(pattern);
        }
    }

    return result;
}

function makeFirewallUpdate() {
    const tabIds = [...hiddenTabs]
        .filter(Number.isInteger);

    const update = {
        removeRuleIds: [RULE_ID],
        addRules: []
    };

    if (tabIds.length) {
        update.addRules.push({
            id: RULE_ID,
            priority: 10000,
            action: { type: 'block' },
            condition: {
                tabIds,
                resourceTypes: [
                    'xmlhttprequest',
                    'websocket',
                    'webtransport',
                    'ping',
                    'csp_report',
                    'other'
                ]
            }
        });
    }

    return update;
}

function settleFirewallWaiters() {
    for (let i = firewallWaiters.length - 1; i >= 0; i--) {
        const waiter = firewallWaiters[i];
        if (waiter.revision <= firewallAppliedRevision) {
            firewallWaiters.splice(i, 1);
            waiter.resolve();
        }
    }
}

function rejectFirewallWaiters(error) {
    const waiters = firewallWaiters.splice(0);
    for (const waiter of waiters) {
        waiter.reject(error);
    }
}

function ensureFirewallRunner() {
    if (firewallRunner) {
        return;
    }

    firewallRunner = (async () => {
        try {
            while (firewallAppliedRevision < firewallWantedRevision) {
                const targetRevision = firewallWantedRevision;
                const update = makeFirewallUpdate();

                await chrome.declarativeNetRequest
                    .updateSessionRules(update);

                firewallAppliedRevision = targetRevision;
                settleFirewallWaiters();
            }
        } catch (error) {
            firewallWantedRevision = firewallAppliedRevision;
            rejectFirewallWaiters(error);
            throw error;
        } finally {
            firewallRunner = null;
            if (firewallAppliedRevision < firewallWantedRevision) {
                ensureFirewallRunner();
            }
        }
    })().catch(error => {
        console.error(TAG, 'firewall update failed:', error);
    });
}

function rebuildFirewall() {
    const revision = ++firewallWantedRevision;
    const promise = new Promise((resolve, reject) => {
        firewallWaiters.push({ revision, resolve, reject });
    });
    ensureFirewallRunner();
    return promise;
}

async function setHidden(tabId, hidden) {
    if (!Number.isInteger(tabId)) {
        return;
    }

    if (hidden) {
        hiddenTabs.add(tabId);
    } else {
        hiddenTabs.delete(tabId);
    }

    await rebuildFirewall();
}

function contentScriptMatchConfig(patterns) {
    const matches = SP.uniqueChromeMatches(patterns);
    const excludes = new Set();

    for (const pattern of patterns) {
        if (!pattern.subdomains) {
            continue;
        }

        for (const broad of SP.chromeMatches(pattern)) {
            const apex = broad.replace('://*.', '://');
            const broadScheme = broad.slice(0, broad.indexOf('://'));
            const covered = patterns.some(candidate =>
                !candidate.subdomains &&
                candidate.hostname === pattern.hostname &&
                (!candidate.scheme || candidate.scheme === broadScheme)
            );

            // excludeMatches cannot express a port. If any exact-apex rule
            // exists for this scheme (even a port-specific one), keep the
            // broad injection and let TNG's runtime matcher enforce the port.
            if (!covered) {
                excludes.add(apex);
            }
        }
    }

    return {
        matches,
        excludeMatches: [...excludes].sort()
    };
}

async function syncVisibilityScript(patterns) {
    await chrome.scripting
        .unregisterContentScripts({ ids: [VIS_SCRIPT_ID] })
        .catch(() => {});

    if (!patterns.length) {
        return;
    }

    const config = contentScriptMatchConfig(patterns);
    const script = {
        id: VIS_SCRIPT_ID,
        matches: config.matches,
        js: ['visibility.js'],
        runAt: 'document_start',
        world: 'ISOLATED',
        persistAcrossSessions: true
    };

    if (config.excludeMatches.length) {
        script.excludeMatches = config.excludeMatches;
    }

    await chrome.scripting.registerContentScripts([script]);
}

async function sendEnabled(tabId, enabled) {
    try {
        await chrome.tabs.sendMessage(tabId, {
            type: 'TNG_SET_ENABLED',
            enabled
        });
    } catch {}
}

async function queryCandidateTabs(patterns) {
    const matches = SP.uniqueChromeMatches(patterns);
    if (!matches.length) {
        return [];
    }

    const tabs = await chrome.tabs.query({ url: matches });
    const seen = new Set();
    return tabs.filter(tab => {
        if (!Number.isInteger(tab.id) || seen.has(tab.id)) {
            return false;
        }
        seen.add(tab.id);
        return true;
    });
}

async function inspectExistingTab(tab) {
    const tabId = tab?.id;

    if (
        !Number.isInteger(tabId) ||
        tab.discarded ||
        !isManagedUrl(tab.url || '')
    ) {
        return;
    }

    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['visibility.js'],
            world: 'ISOLATED',
            injectImmediately: true
        });

        const result = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'ISOLATED',
            injectImmediately: true,
            func: () => document.visibilityState !== 'visible'
        });

        if (Boolean(result?.[0]?.result)) {
            hiddenTabs.add(tabId);
        } else {
            hiddenTabs.delete(tabId);
        }
    } catch {
        hiddenTabs.delete(tabId);
    }

    await sendEnabled(tabId, true);
}

async function reconfigureNow() {
    const previousPatterns = managedPatterns;
    const nextPatterns = await readConfiguredPatterns();
    managedPatterns = nextPatterns;

    await syncVisibilityScript(nextPatterns);

    const candidateTabs = await queryCandidateTabs([
        ...previousPatterns,
        ...nextPatterns
    ]);

    const removedTabIds = [];
    for (const tab of candidateTabs) {
        const url = tab.url || '';
        const wasManaged = previousPatterns.some(pattern =>
            SP.matchesUrl(pattern, url)
        );
        const nowManaged = nextPatterns.some(pattern =>
            SP.matchesUrl(pattern, url)
        );

        if (wasManaged && !nowManaged && Number.isInteger(tab.id)) {
            hiddenTabs.delete(tab.id);
            removedTabIds.push(tab.id);
        }
    }

    if (removedTabIds.length) {
        await rebuildFirewall();
        for (const tabId of removedTabIds) {
            await sendEnabled(tabId, false);
        }
    }

    hiddenTabs.clear();

    const currentTabs = await queryCandidateTabs(nextPatterns);
    for (const tab of currentTabs) {
        if (isManagedUrl(tab.url || '')) {
            await inspectExistingTab(tab);
        }
    }

    await rebuildFirewall();
}

function scheduleReconfigure() {
    reconfigureChain = reconfigureChain
        .catch(() => {})
        .then(() => reconfigureNow());
    return reconfigureChain;
}

function ensureInitialized() {
    if (initialized) {
        return Promise.resolve();
    }

    if (initializePromise) {
        return initializePromise;
    }

    initializePromise = scheduleReconfigure()
        .then(() => {
            initialized = true;
        })
        .finally(() => {
            initializePromise = null;
        });

    return initializePromise;
}

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
        if (message?.type === 'TNG_REFRESH_CONFIG') {
            scheduleReconfigure()
                .then(() => sendResponse({ ok: true }))
                .catch(error => sendResponse({
                    ok: false,
                    error: String(error)
                }));
            return true;
        }

        if (message?.type !== 'TNG_LITE_VISIBILITY') {
            return;
        }

        const tabId = sender.tab?.id;

        (async () => {
            await ensureInitialized();

            if (
                !Number.isInteger(tabId) ||
                !isManagedUrl(sender.tab?.url || '')
            ) {
                if (Number.isInteger(tabId)) {
                    await setHidden(tabId, false);
                }

                sendResponse({
                    ok: false,
                    unmanaged: true
                });
                return;
            }

            await setHidden(tabId, Boolean(message.hidden));
            sendResponse({ ok: true });
        })().catch(error => sendResponse({
            ok: false,
            error: String(error)
        }));

        return true;
    }
);

chrome.tabs.onRemoved.addListener(tabId => {
    if (hiddenTabs.delete(tabId)) {
        rebuildFirewall();
    }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
    if (hiddenTabs.delete(tabId)) {
        rebuildFirewall().catch(error => console.error(TAG, error));
    }
});

chrome.tabs.onHighlighted.addListener(({ tabIds }) => {
    let changed = false;
    for (const tabId of tabIds || []) {
        changed = hiddenTabs.delete(tabId) || changed;
    }
    if (changed) {
        rebuildFirewall().catch(error => console.error(TAG, error));
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (
        changeInfo.url &&
        !isManagedUrl(changeInfo.url) &&
        hiddenTabs.delete(tabId)
    ) {
        rebuildFirewall();
    }
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (
        area === 'local' &&
        (changes[STORAGE_KEY] || changes[LEGACY_STORAGE_KEY])
    ) {
        scheduleReconfigure().catch(error => console.error(TAG, error));
    }
});

chrome.permissions.onAdded.addListener(() => {
    scheduleReconfigure().catch(error => console.error(TAG, error));
});

chrome.permissions.onRemoved.addListener(() => {
    scheduleReconfigure().catch(error => console.error(TAG, error));
});

chrome.runtime.onInstalled.addListener(() => {
    ensureInitialized().catch(error => console.error(TAG, error));
});

chrome.runtime.onStartup.addListener(() => {
    ensureInitialized().catch(error => console.error(TAG, error));
});

ensureInitialized().catch(error => console.error(TAG, error));
