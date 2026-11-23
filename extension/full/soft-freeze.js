(() => {
    'use strict';

    if (window.__TNG_SOFT_FREEZE_V1__) {
        return;
    }

    window.__TNG_SOFT_FREEZE_V1__ = true;

    const DEBUG = false;
    const TAG = '[TNG-SoftFreeze]';
    const CHANNEL = 'TNG_NETWORK_GOVERNOR_V1';
    const RESUME_GAP_MS = 120;

    const nativeFetch = window.fetch.bind(window);
    const nativeXHROpen = XMLHttpRequest.prototype.open;
    const nativeXHRSend = XMLHttpRequest.prototype.send;
    const nativeXHRAbort = XMLHttpRequest.prototype.abort;
    const nativeBeacon = navigator.sendBeacon
        ? navigator.sendBeacon.bind(navigator)
        : null;

    const pendingReads = new Map();
    const readyWaiters = new Set();

    let resumeChain = Promise.resolve();
    let bridgeSequence = 0;
    let bridgeReporterStartedAt = -Infinity;
    let bridgeReporterId = null;
    let enabled = true;
    let networkReady = false;

    const stats = {
        installedAt: new Date().toISOString(),
        frozenFetch: 0,
        dedupedFetch: 0,
        frozenXHR: 0,
        droppedBeacon: 0,
        resumed: 0,
        ackWaits: 0,
        ackReady: 0
    };

    Object.defineProperty(
        window,
        '__TNG_STATS__',
        {
            value: stats,
            configurable: false,
            enumerable: false,
            writable: false
        }
    );

    function debug(...args) {
        if (DEBUG) {
            console.debug(TAG, ...args);
        }
    }

    function visible() {
        return document.visibilityState === 'visible';
    }

    function canUseNetwork() {
        return !enabled || (visible() && networkReady);
    }

    function wakeReadyWaiters() {
        if (!canUseNetwork()) {
            return;
        }

        for (const resolve of readyWaiters) {
            try {
                resolve();
            } catch {}
        }

        readyWaiters.clear();
    }

    window.addEventListener(
        'message',
        event => {
            if (
                event.source !== window ||
                event.origin !== location.origin
            ) {
                return;
            }

            const data = event.data;

            if (data?.source !== CHANNEL) {
                return;
            }

            const seq = Number(data.sequence) || 0;
            const reporterStartedAt =
                Number(data.reporterStartedAt) || 0;
            const reporterId =
                String(data.reporterId || 'legacy');

            // A content-script context is replaced when the extension is
            // reloaded, while this MAIN-world soft-freeze can remain alive in
            // the page. Adopt a newer reporter generation and reset the local
            // sequence gate. Messages from an older retired reporter are then
            // ignored even if one of its DOM listeners fires late.
            if (reporterStartedAt < bridgeReporterStartedAt) {
                return;
            }

            if (
                reporterStartedAt > bridgeReporterStartedAt ||
                reporterId !== bridgeReporterId
            ) {
                bridgeReporterStartedAt = reporterStartedAt;
                bridgeReporterId = reporterId;
                bridgeSequence = 0;
            }

            if (seq < bridgeSequence) {
                return;
            }

            bridgeSequence = seq;

            if (data.type === 'CONTROL') {
                enabled = Boolean(data.enabled);
                networkReady =
                    !enabled || Boolean(data.ready);

                if (canUseNetwork()) {
                    wakeReadyWaiters();
                }

                return;
            }

            if (data.type !== 'NETWORK_STATE') {
                return;
            }

            if (data.hidden || !data.ready) {
                networkReady = false;
                return;
            }

            if (enabled && visible()) {
                networkReady = true;
                stats.ackReady++;
                wakeReadyWaiters();
            }
        },
        false
    );

    // Hidden must freeze immediately. Visible does not set networkReady=true;
    // only the DNR-unblock ACK is allowed to do that.
    document.addEventListener(
        'visibilitychange',
        () => {
            if (enabled && !visible()) {
                networkReady = false;
            }
        },
        true
    );

    function waitUntilNetworkReady() {
        if (canUseNetwork()) {
            return Promise.resolve();
        }

        stats.ackWaits++;

        return new Promise(resolve => {
            readyWaiters.add(resolve);
        });
    }

    function reserveResumeSlot() {
        const slot = resumeChain;

        resumeChain = resumeChain
            .catch(() => {})
            .then(
                () => new Promise(resolve =>
                    setTimeout(resolve, RESUME_GAP_MS)
                )
            );

        return slot;
    }

    function getRequestInfo(input, init) {
        const method = String(
            init?.method ||
            (
                typeof input !== 'string'
                    ? input?.method
                    : null
            ) ||
            'GET'
        ).toUpperCase();

        let url;

        try {
            url = new URL(
                typeof input === 'string'
                    ? input
                    : input.url,
                location.href
            ).href;
        } catch {
            url = String(input);
        }

        return {
            method,
            url,
            key: `${method} ${url}`
        };
    }

    window.fetch = function(input, init) {
        if (canUseNetwork()) {
            return nativeFetch(input, init);
        }

        const info = getRequestInfo(input, init);
        stats.frozenFetch++;

        const isRead =
            info.method === 'GET' ||
            info.method === 'HEAD';

        if (isRead && pendingReads.has(info.key)) {
            stats.dedupedFetch++;

            return pendingReads
                .get(info.key)
                .then(response => response.clone());
        }

        const task = (async () => {
            await waitUntilNetworkReady();

            const signal =
                init?.signal ||
                (
                    typeof input !== 'string'
                        ? input?.signal
                        : null
                );

            if (signal?.aborted) {
                throw (
                    signal.reason ||
                    new DOMException(
                        'The operation was aborted.',
                        'AbortError'
                    )
                );
            }

            await reserveResumeSlot();

            // The tab may become hidden again while waiting its resume slot.
            await waitUntilNetworkReady();

            stats.resumed++;
            debug('resume fetch', info.method);

            return nativeFetch(input, init);
        })();

        if (!isRead) {
            return task;
        }

        pendingReads.set(info.key, task);

        task.finally(() => {
            if (pendingReads.get(info.key) === task) {
                pendingReads.delete(info.key);
            }
        });

        return task.then(response => response.clone());
    };

    XMLHttpRequest.prototype.open =
        function(method, url, ...args) {
            this.__tngFreezeInfo = {
                aborted: false
            };

            return nativeXHROpen.call(
                this,
                method,
                url,
                ...args
            );
        };

    XMLHttpRequest.prototype.send =
        function(body) {
            if (canUseNetwork()) {
                return nativeXHRSend.call(this, body);
            }

            const xhr = this;
            stats.frozenXHR++;

            (async () => {
                await waitUntilNetworkReady();

                if (xhr.__tngFreezeInfo?.aborted) {
                    return;
                }

                await reserveResumeSlot();
                await waitUntilNetworkReady();

                if (xhr.__tngFreezeInfo?.aborted) {
                    return;
                }

                stats.resumed++;

                try {
                    nativeXHRSend.call(xhr, body);
                } catch (error) {
                    debug('XHR resume failed', error);
                }
            })();

            return undefined;
        };

    XMLHttpRequest.prototype.abort =
        function() {
            if (this.__tngFreezeInfo) {
                this.__tngFreezeInfo.aborted = true;
            }

            return nativeXHRAbort.call(this);
        };

    if (nativeBeacon) {
        navigator.sendBeacon = function(url, data) {
            if (!canUseNetwork()) {
                stats.droppedBeacon++;
                return true;
            }

            return nativeBeacon(url, data);
        };
    }
})();
