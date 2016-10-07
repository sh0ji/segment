/**
 * --------------------------------------------------------------------------
 * Segment (v1.0.3): segment.js
 * Validate and improve the semantics of an HTML document
 * by Evan Yamanishi
 * Licensed under MIT
 * --------------------------------------------------------------------------
 */

'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NAME = 'segment';
var VERSION = '1.0.3';
var NAMESPACE = 'nest';
var HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

// initialize private(ish) variables
var HeadingSubset = [];
var PageIDs = [];
var Level = {
    current: 0,
    previous: 0,
    previousEl: null,
    parent: null
};

var Default = {
    createToC: true,
    excludeClassSection: 'sec-exclude',
    excludeClassToc: 'toc-exclude',
    start: 1,
    end: 6,
    sectionClass: 'section-container',
    sectionWrap: true,
    tocClass: NAMESPACE + '-contents'
};

// errors borrowed from Khan Academy's tota11y library
// https://github.com/Khan/tota11y
var Error = {
    FIRST_NOT_H1: function FIRST_NOT_H1(level, el) {
        return {
            title: 'First heading is not an <h1>.',
            description: 'To give your document a proper structure for assistive technologies, it is important to lay out your headings beginning with an <h1>. The first heading was an <h' + level + '>.',
            element: el
        };
    },
    NONCONSECUTIVE_HEADER: function NONCONSECUTIVE_HEADER(prevLevel, currLevel, el) {
        var description = 'This document contains an <h' + currLevel + '> tag directly following an <h' + prevLevel + '>. In order to maintain a consistent outline of the page for assistive technologies, reduce the gap in the heading level by upgrading this tag to an <h' + (prevLevel + 1) + '>';

        // Suggest upgrading the tag to the same level as `prevLevel` iff
        // `prevLevel` is not 1
        if (prevLevel !== 1) {
            description += ' or <h' + prevLevel + '>.';
        } else {
            description += '.';
        }

        return {
            title: 'Nonconsecutive heading level used (h' + prevLevel + ' → h' + currLevel + ').',
            description: description,
            element: el
        };
    },

    // additional errors (not in tota11y)
    NO_HEADINGS_FOUND: function NO_HEADINGS_FOUND() {
        return {
            title: 'No headings found.',
            description: 'Please ensure that all headings are properly tagged.'
        };
    },
    PRE_EXISTING_SECTION: function PRE_EXISTING_SECTION(level, el) {
        return {
            title: 'Pre-existing <section> tag',
            description: 'The current h' + level + ' is already the child of a <section> tag.',
            element: el,
            warning: true
        };
    }
};

var Segment = function () {
    function Segment(doc, config) {
        _classCallCheck(this, Segment);

        if (typeof config === 'string') {
            if (data[config] === undefined) {
                throw new Error('No method named "' + config + '"');
            }
            this[config]();
        } else {
            this.config = this._getConfig(config);
        }

        this.doc = doc;

        // get all the ids on the page so we can construct unique ones
        this._getPageIDs();

        // construct a subset of headings (e.g. h2-h4) based on
        // start and end values specified in config
        this._createHeadingSubset();

        // initialize the table of contents (ToC)
        if (this.config.createToC) this.toc = this._initToC();

        // build the heading object
        this.headings = this._getHeadings();
        if (this.headings.length === 0) this._postError(Error.NO_HEADINGS_FOUND());
    }

    // public


    // private

    // overwrite default options with supplied options


    _createClass(Segment, [{
        key: '_getConfig',
        value: function _getConfig(config) {
            return Object.assign({}, Default, config);
        }
    }, {
        key: '_getHeadings',
        value: function _getHeadings() {
            var headings = {};
            var c = this._headingCount();
            headings.count = c.heads;
            headings.length = c.total;

            headings.items = this._getHeadingItems();

            return headings;
        }
    }, {
        key: '_headingCount',
        value: function _headingCount() {
            var heads = {};
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = HEADINGS[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var heading = _step.value;

                    heads[heading] = heading.length;
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }

            return heads;
        }
    }, {
        key: '_validateHeading',
        value: function _validateHeading(item, el) {
            // first heading not h1
            if (Level.previous === 0 && item.level !== 1) {
                this._postError(Error.FIRST_NOT_H1(item.level, el));
                return false;

                // non-consecutive headings
            } else if (Level.previous !== 0 && item.level - Level.previous > 1) {
                this._postError(Error.NONCONSECUTIVE_HEADER(Level.previous, item.level, el));
                return false;
            }
            return true;
        }
    }, {
        key: '_postError',
        value: function _postError(err) {
            var severity = err.warning ? 'warning' : 'error';
            var errString = 'HEADING ' + severity.toUpperCase() + '\nType: ' + err.title + '\nInfo: ' + err.description;
            if (err.element) {
                var output = errString + '\nProblem heading:';
                if (err.warning) {
                    console.warn(output, err.element);
                } else {
                    console.error(output, err.element);
                }
                err.element.className = severity + '--heading';
            } else {
                console.error(errString);
            }
        }
    }, {
        key: '_contains',
        value: function _contains(array, value) {
            return array.indexOf(value) >= 0;
        }
    }, {
        key: '_getHeadings',
        value: function _getHeadings() {
            var headings = this.doc.querySelectorAll(HEADINGS.toString());

            // initialize the headings object
            var headingMeta = {
                count: {},
                items: [],
                length: headings.length,
                wellStructured: true
            };

            // iterate over every heading in DOM order
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
                for (var _iterator2 = headings[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    var heading = _step2.value;


                    var headingClasses = heading.getAttribute('class') || '';

                    // create object to hold heading metadata
                    var item = {
                        classString: headingClasses,
                        contents: heading.textContent,
                        excludeSection: this._contains(headingClasses, this.config.excludeClassSection),
                        excludeToc: this._contains(headingClasses, this.config.excludeClassToc),
                        id: this._constructID(heading.textContent),
                        level: parseInt(heading.nodeName.substr(1)),
                        tag: heading.tagName.toLowerCase()
                    };

                    // move the level iterators forward
                    Level.previous = Level.current;
                    Level.current = item.level;

                    // validate the heading
                    item.valid = this._validateHeading(item, heading);

                    // one bad heading makes the whole document poorly structured
                    if (!item.valid) headingMeta.wellStructured = false;

                    // proceed if the heading is valid
                    if (headingMeta.wellStructured) {
                        // wrap in sections
                        // specified in the config
                        if (this.config.sectionWrap &&
                        // current heading level is >= the specified start level
                        item.level >= this.config.start &&
                        // the current heading shouldn't be excluded
                        !item.excludeSection) {
                            this._sectionWrap(heading, item);
                        }

                        // create table of contents using the specified heading subset (h1-h6 by default)
                        if (this.config.createToC && this._contains(HeadingSubset, item.level) && !item.excludeToc) {
                            this._addTocItem(item);
                        }

                        // iterate the count
                        if (typeof headingMeta.count[item.tag] === 'undefined') {
                            headingMeta.count[item.tag] = 1;
                        } else {
                            headingMeta.count[item.tag]++;
                        }
                    }

                    // add the object to the array
                    headingMeta.items.push(item);
                }
            } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion2 && _iterator2.return) {
                        _iterator2.return();
                    }
                } finally {
                    if (_didIteratorError2) {
                        throw _iteratorError2;
                    }
                }
            }

            delete this.doc;
            return headingMeta;
        }
    }, {
        key: '_createHeadingSubset',
        value: function _createHeadingSubset() {
            var _this = this;

            HEADINGS.forEach(function (h, i) {
                var level = i + 1;
                if (_this.config.start <= level || typeof _this.config.start === 'undefined') {
                    if (_this.config.end >= level || typeof _this.config.end === 'undefined') {
                        HeadingSubset.push(level);
                    }
                }
            });
            return true;
        }
    }, {
        key: '_getPageIDs',
        value: function _getPageIDs() {
            var ids = this.doc.querySelectorAll('[id]');
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;

            try {
                for (var _iterator3 = ids[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                    var item = _step3.value;

                    PageIDs.push(item.getAttribute('id'));
                }
            } catch (err) {
                _didIteratorError3 = true;
                _iteratorError3 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion3 && _iterator3.return) {
                        _iterator3.return();
                    }
                } finally {
                    if (_didIteratorError3) {
                        throw _iteratorError3;
                    }
                }
            }

            return true;
        }
    }, {
        key: '_constructID',
        value: function _constructID(string) {
            var id = string.trim()
            // start with letter, remove apostrophes & quotes
            .replace(/^[^A-Za-z]*/, '').replace(/[‘’'“”"]/g, '')
            // replace all symbols with - except at the end
            .replace(/[^A-Za-z0-9]+/g, '-').replace(/-$/g, '').toLowerCase();

            // append a number if the id isn't unique
            if (this._contains(PageIDs, id)) {
                var root = id;
                var n = 0;
                do {
                    n++;
                    id = root + '-' + n;
                } while (this._contains(PageIDs, id));
            }
            return id;
        }
    }, {
        key: '_sectionWrap',
        value: function _sectionWrap(el, item) {

            if (el.parentElement.tagName === 'SECTION' && el.parentElement.className !== this.config.sectionClass) {
                this._postError(Error.PRE_EXISTING_SECTION(item.level, el));
            }

            // create the section container
            var section = this.doc.createElement('section');
            section.setAttribute('id', item.id);
            section.className = this.config.sectionClass;

            // replace the heading text with a non-tabbable anchor that
            // references the section
            var anchor = this.doc.createElement('a');
            anchor.setAttribute('href', '#' + item.id);
            anchor.setAttribute('tabindex', -1);
            anchor.textContent = item.contents;
            el.innerHTML = anchor.outerHTML;
            el.className = 'heading-link';

            var prev = el.previousSibling;
            var matched = this._nextUntilSameTag(el, item);

            matched.forEach(function (elem) {
                section.appendChild(elem);
            });

            if (prev) prev.parentNode.insertBefore(section, prev.nextSibling);
        }

        // collect all the elements from el to the next same tagName
        // borrowed from jQuery.nextUntil()

    }, {
        key: '_nextUntilSameTag',
        value: function _nextUntilSameTag(el, item) {
            var matched = [];
            matched.push(el);
            while ((el = el.nextSibling) && el.nodeType !== 9) {
                var level = parseInt(el.nodeName.substr(1)) || null;
                if (el.nodeType === 1) {
                    if (el.nodeName === item.tag || level && level < item.level) break;
                    matched.push(el);
                }
            }
            return matched;
        }
    }, {
        key: '_initToC',
        value: function _initToC() {
            var toc = this.doc.createElement('ul');
            toc.className = this.config.tocClass + ' ' + this.config.tocClass + '--h' + this.config.start;
            return toc;
        }
    }, {
        key: '_addTocItem',
        value: function _addTocItem(item) {
            var li = this._createListItem(item);
            var depth = item.level - this.config.start;
            if (this._contains(HeadingSubset, Level.previous)) Level.previousEl = Level.previous;
            var change = item.level - Level.previousEl;

            if (depth === 0) {
                Level.parent = this.toc;
            } else if (change > 0) {
                var ul = this.doc.createElement('ul');
                ul.className = this.config.tocClass + '--' + item.tag;
                Level.parent.lastChild.appendChild(ul);
                Level.parent = ul;
            } else if (change < 0) {
                var i = 0;
                while (i < Math.abs(change)) {
                    Level.parent = Level.parent.parentElement;
                    if (Level.parent.nodeName === 'UL') i++;
                }
            }
            Level.parent.appendChild(li);
        }
    }, {
        key: '_createListItem',
        value: function _createListItem(item) {
            if (item.excludeToc) return;
            var li = this.doc.createElement('li');
            li.className = this.config.tocClass + '__item';
            var tocLink = this.doc.createElement('a');
            tocLink.setAttribute('href', '#' + item.id);
            tocLink.className = this.config.tocClass + '__link';
            tocLink.textContent = item.contents;

            li.appendChild(tocLink);
            return li;
        }

        // static

    }], [{
        key: 'init',
        value: function init(doc, config) {
            return new Segment(doc, config);
        }
    }]);

    return Segment;
}();

exports.default = Segment;