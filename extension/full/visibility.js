(() => {
    'use strict';

    if (globalThis.__TNG_VISIBILITY_REPORTER_V1__) {
        return;
    }

    globalThis.__TNG_VISIBILITY_REPORTER_V1__ = true;

    const CHANNEL = 'TNG_NETWORK_GOVERNOR_V1';
    const REPORTER_STARTED_AT =
        Math.floor((performance.timeOrigin + performance.now()) * 1000);
    const REPORTER_ID =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let enabled = true;
    let retired = false;
    let lastState = null;

    // Start from a page-monotonic timestamp rather than 0. This lets a newly
    // injected reporter take over an older MAIN-world soft-freeze instance
    // after an extension reload, even if that older instance only understands
    // sequence numbers and not reporter generations.
    let sequence = REPORTER_STARTED_AT;

    function nextSequence() {
        const now = Math.floor(
            (performance.timeOrigin + performance.now()) * 1000
        );

        sequence = Math.max(sequence + 1, now);
        return sequence;
    }

    function notifyMain(payload) {
        window.postMessage(
            {
                source: CHANNEL,
                reporterId: REPORTER_ID,
                reporterStartedAt: REPORTER_STARTED_AT,
                ...payload
            },
            location.origin
        );
    }

    function removePageListeners() {
        document.removeEventListener(
            'visibilitychange',
            onVisibilityChange,
            true
        );

        window.removeEventListener(
            'pageshow',
            onPageShow,
            true
        );

        window.removeEventListener(
            'pagehide',
            onPageHide,
            true
        );
    }

    function retire(reason) {
        if (retired) {
            return;
        }

        retired = true;
        enabled = false;
        lastState = null;
        removePageListeners();

        // If no newer reporter has taken over yet, fail open at the page
        // soft-freeze layer. A newer reporter has a later reporterStartedAt
        // and the MAIN-world bridge will ignore this older retirement message.
        notifyMain({
            type: 'CONTROL',
            enabled: false,
            ready: true,
            hidden: document.visibilityState !== 'visible',
            sequence: nextSequence(),
            reason
        });
    }

    function contextLooksInvalid() {
        try {
            return !globalThis.chrome?.runtime?.id;
        } catch {
            return true;
        }
    }

    async function safeSend(message) {
        if (retired || contextLooksInvalid()) {
            retire('extension-context-unavailable');
            return null;
        }

        try {
            return await chrome.runtime.sendMessage(message);
        } catch (error) {
            const text = String(error?.message || error || '');

            if (
                contextLooksInvalid() ||
                text.includes('Extension context invalidated')
            ) {
                retire('extension-context-invalidated');
            }

            return null;
        }
    }

    async function report(force = false) {
        if (!enabled || retired) {
            return;
        }

        const hidden =
            document.visibilityState !== 'visible';

        if (!force && hidden === lastState) {
            return;
        }

        lastState = hidden;
        const seq = nextSequence();

        // MAIN world must freeze immediately. A visible state is only a
        // request to unlock; it is not permission to resume yet.
        notifyMain({
            type: 'NETWORK_STATE',
            ready: false,
            hidden,
            sequence: seq,
            reason: hidden ? 'hidden' : 'unlocking'
        });

        const response = await safeSend({
            type: 'TNG_VISIBILITY_V1',
            hidden,
            sequence: seq
        });

        if (
            !response ||
            retired ||
            seq !== sequence ||
            !enabled
        ) {
            return;
        }

        if (response?.unmanaged && response?.unblocked) {
            enabled = false;
            notifyMain({
                type: 'CONTROL',
                enabled: false,
                ready: true,
                hidden,
                sequence: seq,
                reason: 'unmanaged-runtime-filter'
            });
            return;
        }

        if (
            !hidden &&
            document.visibilityState === 'visible' &&
            response?.ok &&
            response?.unblocked &&
            response?.sequence === seq
        ) {
            notifyMain({
                type: 'NETWORK_STATE',
                ready: true,
                hidden: false,
                sequence: seq,
                reason: 'dnr-unblocked'
            });
        }
    }

    function onRuntimeMessage(message) {
        if (message?.type !== 'TNG_SET_ENABLED' || retired) {
            return;
        }

        enabled = Boolean(message.enabled);
        const seq = nextSequence();
        lastState = null;

        notifyMain({
            type: 'CONTROL',
            enabled,
            ready: !enabled,
            hidden: document.visibilityState !== 'visible',
            sequence: seq,
            reason: enabled ? 'enabled' : 'disabled'
        });

        if (enabled) {
            void report(true);
        }
    }

    function onVisibilityChange() {
        void report();
    }

    function onPageShow() {
        void report(true);
    }

    function onPageHide() {
        if (!enabled || retired) {
            return;
        }

        const seq = nextSequence();
        lastState = true;

        notifyMain({
            type: 'NETWORK_STATE',
            ready: false,
            hidden: true,
            sequence: seq,
            reason: 'pagehide'
        });

        // sendMessage may throw synchronously when an extension was reloaded
        // and this old content-script context has been invalidated. safeSend()
        // catches both synchronous throws and rejected promises.
        void safeSend({
            type: 'TNG_VISIBILITY_V1',
            hidden: true,
            sequence: seq
        });
    }

    try {
        chrome.runtime.onMessage.addListener(onRuntimeMessage);
    } catch {
        retire('extension-context-invalidated-at-startup');
        return;
    }

    document.addEventListener(
        'visibilitychange',
        onVisibilityChange,
        true
    );

    window.addEventListener(
        'pageshow',
        onPageShow,
        true
    );

    window.addEventListener(
        'pagehide',
        onPageHide,
        true
    );

    void report(true);
})();
