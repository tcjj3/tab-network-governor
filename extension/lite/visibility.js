(() => {
    'use strict';

    const STATE_KEY = '__TNG_LITE_VISIBILITY_REPORTER__';
    const previous = globalThis[STATE_KEY];

    if (previous?.report) {
        document.removeEventListener(
            'visibilitychange',
            previous.report,
            true
        );

        window.removeEventListener(
            'pageshow',
            previous.report,
            true
        );
    }

    let enabled = true;
    let retired = false;

    function retire() {
        if (retired) {
            return;
        }

        retired = true;
        enabled = false;

        document.removeEventListener(
            'visibilitychange',
            report,
            true
        );

        window.removeEventListener(
            'pageshow',
            report,
            true
        );
    }

    function contextLooksInvalid() {
        try {
            return !globalThis.chrome?.runtime?.id;
        } catch {
            return true;
        }
    }

    async function report() {
        if (!enabled || retired) {
            return;
        }

        if (contextLooksInvalid()) {
            retire();
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'TNG_LITE_VISIBILITY',
                hidden: document.visibilityState !== 'visible'
            });

            // Registered Chrome match patterns can be broader than TNG's
            // runtime rule (notably port-specific patterns). Stop reporting
            // on a page that the background matcher says is actually outside
            // the configured rule.
            if (response?.unmanaged) {
                enabled = false;
            }
        } catch (error) {
            const text = String(error?.message || error || '');

            if (
                contextLooksInvalid() ||
                text.includes('Extension context invalidated')
            ) {
                retire();
            }
        }
    }

    chrome.runtime.onMessage.addListener(message => {
        if (message?.type !== 'TNG_SET_ENABLED') {
            return;
        }

        enabled = Boolean(message.enabled);

        if (enabled) {
            report();
        }
    });

    globalThis[STATE_KEY] = { report };

    report();

    document.addEventListener(
        'visibilitychange',
        report,
        true
    );

    window.addEventListener(
        'pageshow',
        report,
        true
    );
})();
