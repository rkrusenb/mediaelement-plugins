'use strict';

mejs.i18n.en['mejs.a11y-audio-description'] = 'Toggle audio description';
mejs.i18n.en['mejs.a11y-video-description'] = 'Toggle sign language';

Object.assign(mejs.MepDefaults, {
    /**
     * Video description is toggled
     * @type {Boolean}
     */
    videoDescriptionToggled: false,

    /**
     * Audio description is toggled
     * @type {Boolean}
     */
    audioDescriptionToggled: false,

    /**
     * Store for initial source file
     * @type {?{src: String, type: String}}
     */
    defaultSource: null,

    /**
     * Store for best matching audio description file
     * @type {?String}
     */
    audioDescriptionSource: null,

    /**
     * Store for best matching video description file
     * @type {?String}
     */
    videoDescriptionSource: null,

    /**
     * Player is currently playing
     * @type {Boolean}
     */
    isPlaying: false,

    /**
     * Should audio description be voiceover
     * @type {Boolean}
     */
    isVoiceover: false,

    /**
     * Audio description player has fired the canplay event
     * @type {Boolean}
     */
    audioDescriptionCanPlay: false,

    /**
	 * The path where the icon sprite is located
	 * @type {String}
	 */
	iconSpritePathA11y: 'mejs-a11y-icons.svg',
});


Object.assign(MediaElementPlayer.prototype, {
    builda11y ()  {
        const t = this;

        t.options.defaultSource = {
            src: t.node.src,
            type: t.node.type
        };
        t.options.isVoiceover = t._loadBooleanFromAttribute('data-audio-description-voiceover');
        t.options.audioDescriptionSource = t._loadSourceFromAttribute('data-audio-description');
        t.options.videoDescriptionSource = t._loadSourceFromAttribute('data-video-description');

        if (t.options.audioDescriptionSource) t._createAudioDescription();
        if (t.options.videoDescriptionSource) t._createVideoDescription();

        // Store references to event handlers for cleanup
        t.a11yPlayHandler = () => t.options.isPlaying = true;
        t.a11yPlayingHandler = () => t.options.isPlaying = true;
        t.a11yPauseHandler = () => t.options.isPlaying = false;
        t.a11yEndedHandler = () => t.options.isPlaying = false;

        t.media.addEventListener('play', t.a11yPlayHandler);
        t.media.addEventListener('playing', t.a11yPlayingHandler);
        t.media.addEventListener('pause', t.a11yPauseHandler);
        t.media.addEventListener('ended', t.a11yEndedHandler);
    },

    cleana11y (player, layers, controls, media) {
        const t = this;

        // Remove main media event listeners
        if (t.a11yPlayHandler) {
            media.removeEventListener('play', t.a11yPlayHandler);
            media.removeEventListener('playing', t.a11yPlayingHandler);
            media.removeEventListener('pause', t.a11yPauseHandler);
            media.removeEventListener('ended', t.a11yEndedHandler);
        }

        // Clean up audio description button and click handler
        if (t.audioDescriptionButton && t.audioDescriptionClickHandler) {
            t.audioDescriptionButton.removeEventListener('click', t.audioDescriptionClickHandler);
            t.audioDescriptionButton = null;
            t.audioDescriptionClickHandler = null;
        }

        // Clean up video description button and click handler
        if (t.videoDescriptionButton && t.videoDescriptionClickHandler) {
            t.videoDescriptionButton.removeEventListener('click', t.videoDescriptionClickHandler);
            t.videoDescriptionButton = null;
            t.videoDescriptionClickHandler = null;
        }

        // Clean up audio description player if it exists
        if (t.audioDescription) {
            // Remove all event listeners from the audio description node
            if (t.audioDescriptionPlayHandler) {
                media.removeEventListener('play', t.audioDescriptionPlayHandler);
            }
            if (t.audioDescriptionPlayingHandler) {
                media.removeEventListener('playing', t.audioDescriptionPlayingHandler);
            }
            if (t.audioDescriptionPauseHandler) {
                media.removeEventListener('pause', t.audioDescriptionPauseHandler);
            }
            if (t.audioDescriptionWaitingHandler) {
                media.removeEventListener('waiting', t.audioDescriptionWaitingHandler);
            }
            if (t.audioDescriptionEndedHandler) {
                media.removeEventListener('ended', t.audioDescriptionEndedHandler);
            }
            if (t.audioDescriptionTimeupdateHandler) {
                media.removeEventListener('timeupdate', t.audioDescriptionTimeupdateHandler);
            }
            if (t.audioDescriptionVolumechangeHandler) {
                media.removeEventListener('volumechange', t.audioDescriptionVolumechangeHandler);
            }
            if (t.audioDescriptionCanplayHandler) {
                t.audioDescription.node.removeEventListener('canplay', t.audioDescriptionCanplayHandler);
            }

            // MediaElement will clone the <audio> element in the remove() call, so we need to store the ID here for later removal
            const clonedAudioId = t.audioDescription.node.getAttribute('id')
                .replace(`_${media.rendererName}`, '');

            // Remove the audio description player
            t.audioDescription.remove()
            t.audioDescription = null;

            // Remove the cloned audio element from the DOM
            const clonedAudioElement = document.getElementById(clonedAudioId);
            if (clonedAudioElement) {
                clonedAudioElement.parentNode.removeChild(clonedAudioElement);
            }
        }

        // Restore video volume button if it was hidden
        if (t.videoVolumeButton) {
            mejs.Utils.removeClass(t.videoVolumeButton, 'hidden');
            t.videoVolumeButton = null;
        }

        // Clean up descriptive volume button reference
        if (t.descriptiveVolumeButton) {
            t.descriptiveVolumeButton = null;
        }

        // Reset state
        t.options.audioDescriptionToggled = false;
        t.options.videoDescriptionToggled = false;
        t.options.audioDescriptionCanPlay = false;
    },

    /**
     * Get the first child node by class name
     * @private
     * @param {Node} parentNode
     * @param {String} className
     * @returns {Node} childNode
     */
    _getFirstChildNodeByClassName(parentNode, className) {
        return [...parentNode.childNodes].find(node => node.className.indexOf(className) > -1);
    },

    /**
     * Generates an HTML for an SVG icon.
     * @private
     * @param {String} id - ID of the MediaElement player
     * @param {String} classPrefix - Prefix for the class attribute
     * @param {String} iconSpritePathA11y - Path to the SVG sprite containing icons
     * @param {String} iconId - Specific ID of the icon within the SVG sprite
     * @returns {String} The complete HTML string for the SVG element
     */
    _generateIconHtml(id, classPrefix, iconSpritePathA11y, iconId) {
        return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" class="${classPrefix}${iconId}" aria-hidden="true" focusable="false">
            <use xlink:href="${iconSpritePathA11y}#${iconId}"></use></svg>`;
    },

    /**
     * Create audio description button and bind events
     * @private
     * @returns {Undefined}
     */
    _createAudioDescription() {
        const t = this;
        const iconHtml = t._generateIconHtml(t.id, t.options.classPrefix, t.options.iconSpritePathA11y, 'icon-audio');
        const audioDescriptionTitle = mejs.i18n.t('mejs.a11y-audio-description');
        const audioDescriptionButton = document.createElement('div');
        audioDescriptionButton.className = `${t.options.classPrefix}button ${t.options.classPrefix}audio-description-button`;
        audioDescriptionButton.innerHTML = `<button type="button" aria-controls="${t.id}" title="${audioDescriptionTitle}"
                                                    aria-label="${audioDescriptionTitle}" aria-pressed="false" tabindex="0">${iconHtml}</button>`;

        t.addControlElement(audioDescriptionButton, 'audio-description');

        // Store reference to button and handler for cleanup
        t.audioDescriptionButton = audioDescriptionButton;
        t.audioDescriptionClickHandler = () => {
            t.options.audioDescriptionToggled = !t.options.audioDescriptionToggled;
            mejs.Utils.toggleClass(audioDescriptionButton, 'audio-description-on');

            const actualButton = audioDescriptionButton.querySelector('button');
            if (actualButton) {
                actualButton.setAttribute('aria-pressed', mejs.Utils.hasClass(audioDescriptionButton, 'audio-description-on'));
            }

            t._toggleAudioDescription();
        };

        audioDescriptionButton.addEventListener('click', t.audioDescriptionClickHandler);
    },

    /**
     * Create video description button and bind events
     * @private
     * @returns {Undefined}
     */
    _createVideoDescription() {
        const t = this;
        const iconHtml = t._generateIconHtml(t.id, t.options.classPrefix, t.options.iconSpritePathA11y, 'icon-video');
        const videoDescriptionTitle = mejs.i18n.t('mejs.a11y-video-description');
        const videoDescriptionButton = document.createElement('div');
        videoDescriptionButton.className = `${t.options.classPrefix}button ${t.options.classPrefix}video-description-button`;
        videoDescriptionButton.innerHTML = `<button type="button" aria-controls="${t.id}" title="${videoDescriptionTitle}"
                                                    aria-label="${videoDescriptionTitle}" aria-pressed="false" tabindex="0">${iconHtml}</button>`;
        t.addControlElement(videoDescriptionButton, 'video-description');

        // Store reference to button and handler for cleanup
        t.videoDescriptionButton = videoDescriptionButton;
        t.videoDescriptionClickHandler = () => {
            t.options.videoDescriptionToggled = !t.options.videoDescriptionToggled;
            mejs.Utils.toggleClass(videoDescriptionButton, 'video-description-on');

            const actualButton = videoDescriptionButton.querySelector('button');
            if (actualButton) {
                actualButton.setAttribute('aria-pressed', mejs.Utils.hasClass(videoDescriptionButton, 'video-description-on'));
            }

            t._toggleVideoDescription();
        };

        videoDescriptionButton.addEventListener('click', t.videoDescriptionClickHandler);
    },

    /**
     * Load the best matching source file from a data attribute
     * @private
     * @param {String} attribute - data attribute for a source object.
     * @returns {?String} source - best matching source file or null
     */
    _loadSourceFromAttribute(attribute) {
        const t = this;
        if (!t.node.hasAttribute(attribute)) return null;

        let sources = null;
        let json;

        try {
            const data = t.node.getAttribute(attribute);
            json = JSON.parse(data);
        } catch(error) {
            console.error(`error loading ${attribute}: ${error.message}`);
        } finally {
            sources = json;
        }

        return (sources) ? this._evaluateBestMatchingSource(sources) : null;
    },

    /**
     * Evaluate if audio description should be toggled as voiceover
     * @private
     * @param {String} attribute - data attribute for voice over toggle
     * @returns {?Boolean}
     */
    _loadBooleanFromAttribute(attribute) {
        const t = this;
        if(!t.node.hasAttribute(attribute)) return false;

        const boolValue = t.node.getAttribute(attribute);
        return boolValue === 'true' || boolValue === '';
    },

    /**
     * Evaluate the best matching source from an array of sources
     * @private
     * @param {Array.<{src: String, type: String}>} sources
     * @returns {?{src: String, type: String}} source
     */
    _evaluateBestMatchingSource(sources) {
        const getMimeFromType = type => mejs.Utils.getMimeFromType(type);
        const canPlayType = type => this.node.canPlayType(type);
        const matchesBrowser = file => canPlayType(getMimeFromType(file.type));

        // checking most likely support
        const probablySource = sources.find(file => matchesBrowser(file) === 'probably');
        if (probablySource) return probablySource;

        // checking might support
        const alternativeSource = sources.find(file => matchesBrowser(file) === 'maybe');
        if (alternativeSource) return alternativeSource;

        return null;
    },

    /**
     * Create a hidden audio dom node for audio description
     * @private
     * @returns {Undefined}
     */
    _createAudioDescriptionPlayer() {
        const t = this;

        const audioNode = document.createElement('audio');
        audioNode.setAttribute('preload', 'auto');
        audioNode.classList.add(`${t.options.classPrefix}audio-description-player`);
        audioNode.setAttribute('src', t.options.audioDescriptionSource.src);
        audioNode.setAttribute('type', t.options.audioDescriptionSource.type);
        audioNode.load();
        document.body.appendChild(audioNode);

        t.audioDescription = new mejs.MediaElementPlayer(audioNode, {
            features: ['volume'],
            audioVolume: t.options.videoVolume,
            startVolume: t.node.volume,
            pauseOtherPlayers: false,
            // use same iconSprite as in video
            iconSprite: t.options.iconSprite,
            // use same nodeName as in video
            fakeNodeName: t.options.fakeNodeName || 'mediaelementwrapper',
            // Screen reader title is not needed because the audio description player is always hidden.
            hideScreenReaderTitle: true,
        });

        // Store event handler references for cleanup
        t.audioDescriptionCanplayHandler = () => t.options.audioDescriptionCanPlay = true;
        t.audioDescriptionPlayHandler = () => t.audioDescription.node.play().catch(e => console.error(e));
        t.audioDescriptionPlayingHandler = () => t.audioDescription.node.play().catch(e => console.error(e));
        t.audioDescriptionPauseHandler = () => t.audioDescription.node.pause();
        t.audioDescriptionWaitingHandler = () => t.audioDescription.node.pause();
        t.audioDescriptionEndedHandler = () => t.audioDescription.node.pause();
        t.audioDescriptionTimeupdateHandler = () => {
            const shouldSync = Math.abs(t.currentTime - t.audioDescription.node.currentTime) > 0.35;
            const canPlay = t.options.audioDescriptionCanPlay;
            if (shouldSync && canPlay) t.audioDescription.node.currentTime = t.currentTime;
        };

        t.audioDescription.node.addEventListener('canplay', t.audioDescriptionCanplayHandler);
        t.media.addEventListener('play', t.audioDescriptionPlayHandler);
        t.media.addEventListener('playing', t.audioDescriptionPlayingHandler);
        t.media.addEventListener('pause', t.audioDescriptionPauseHandler);
        t.media.addEventListener('waiting', t.audioDescriptionWaitingHandler);
        t.media.addEventListener('ended', t.audioDescriptionEndedHandler);
        t.media.addEventListener('timeupdate', t.audioDescriptionTimeupdateHandler);

        // if audio description is voice over, map volume slider to both players
        // otherwise move the audio players volume slider inside the movie player to simulate normal volume handling
        if(t.options.isVoiceover) {
            t.audioDescriptionVolumechangeHandler = () => t.audioDescription.node.volume = t.node.volume;
            t.media.addEventListener('volumechange', t.audioDescriptionVolumechangeHandler);
        } else {
            const volumeButtonClass = `${t.options.classPrefix}volume-button`;
            const videoVolumeButton = t._getFirstChildNodeByClassName(t.controls, volumeButtonClass);
            t.videoVolumeButton = videoVolumeButton;

            if(videoVolumeButton) {
                const descriptiveVolumeButton = t._getFirstChildNodeByClassName(t.audioDescription.controls, volumeButtonClass);
                videoVolumeButton.classList.add('hidden');
                t.controls.insertBefore(descriptiveVolumeButton, videoVolumeButton.nextSibling);
                t.descriptiveVolumeButton = descriptiveVolumeButton;
            }
        }
    },

    /**
     * Handle audio description toggling
     * @private
     * @returns {Undefined}
     */
    _toggleAudioDescription() {
        const t = this;

        if (!t.audioDescription) t._createAudioDescriptionPlayer();

        if (t.options.audioDescriptionToggled) {
            t.audioDescription.node.volume = t.volume;
            if (t.options.isPlaying && t.audioDescription) {
                t.audioDescription.node.muted = false;
                t.audioDescription.node.play().catch(function (e) {
                    return console.error(e);
                });
            }

            if(!t.options.isVoiceover) {
                t.muted = true;
                t.audioDescription.node.muted = false;
            }

            if(!t.options.isVoiceover && t.videoVolumeButton && t.descriptiveVolumeButton) {
                mejs.Utils.addClass(t.videoVolumeButton, 'hidden');
                mejs.Utils.removeClass(t.descriptiveVolumeButton, 'hidden');
            }
        } else {
            t.volume = t.audioDescription.node.volume;
            t.audioDescription.node.pause();
            t.audioDescription.node.muted = true;

            if(!t.options.isVoiceover) {
                t.muted = false;
                t.audioDescription.node.muted = true;
            }

            if(!t.options.isVoiceover && t.videoVolumeButton && t.descriptiveVolumeButton) {
                mejs.Utils.removeClass(t.videoVolumeButton, 'hidden');
                mejs.Utils.addClass(t.descriptiveVolumeButton, 'hidden');
            }
        }
    },

    /**
     * Handle video description toggling
     * @private
     * @returns {Undefined}
     */
    _toggleVideoDescription() {
        const t = this;
        const currentTime = t.node.currentTime;
        const wasPlaying = t.options.isPlaying;
        const active = t.options.videoDescriptionToggled;

        t.node.pause();

        t.node.src = active ? t.options.videoDescriptionSource.src : t.options.defaultSource.src;
        t.node.type = active ? t.options.videoDescriptionSource.type : t.options.defaultSource.type;
        t.node.load();

        if (wasPlaying) {
            t.node.play()
                .then(() => t.node.currentTime = currentTime)
                .catch(e => console.error(e))
        } else {
            t.node.setCurrentTime(currentTime);
        }
    }
});
