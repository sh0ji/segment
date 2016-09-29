/**
 * --------------------------------------------------------------------------
 * Segment (v1.0.0): segment.js
 * Validate and improve the semantics of an HTML document
 * by Evan Yamanishi
 * Licensed under GPL-3.0
 * --------------------------------------------------------------------------
 */

'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var NAME = 'segment';
var VERSION = '1.0.0';
var NAMESPACE = 'nest';
var HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

// initialize private(ish) variables
var HeadingSubset = [];
var PageIDs = [];
var Level = {
    current: 0,
    previous: 0,
    previousToc: null,
    parent: null
};

var Default = {
    createToC: true,
    excludeClass: 'toc-exclude',
    excludeAll: true,
    tocClass: NAMESPACE + '-contents',
    start: 2,
    end: 4,
    sectionClass: 'section-container',
    sectionWrap: true
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
        key: '_inArray',
        value: function _inArray(array, value) {
            return array.indexOf(value) >= 0;
        }
    }, {
        key: '_getHeadings',
        value: function _getHeadings() {
            var heads = this.doc.querySelectorAll(HEADINGS.toString());

            // initialize the headings object
            var headings = {
                count: {},
                items: [],
                length: heads.length,
                wellStructured: true
            };

            // iterate over every heading in DOM order
            for (var i in heads) {
                if (i === 'length') return true;
                var heading = heads[i];

                // get tag (h1-h6), level (1-6), and text
                var name = heading.tagName.toLowerCase();
                var level = parseInt(heading.nodeName.substr(1));
                var headingText = heading.textContent;

                // create item object
                var item = {
                    name: name,
                    level: level,
                    id: this._constructID(headingText),
                    classList: heading.getAttribute('class') || null,
                    exclude: heading.classList.contains(this.config.excludeClass),
                    contents: headingText
                };

                // move the level iterators forward
                Level.previous = Level.current;
                Level.current = item.level;

                // validate the heading
                var valid = this._validateHeading(item, heading);

                // one invalid heading makes the whole document poorly structured
                if (!valid) headings.wellStructured = false;

                // wrap in sections if desired
                if (headings.wellStructured && this.config.sectionWrap && item.level >= this.config.start) {
                    this._sectionWrap(heading, item);
                }

                // create table of contents using the heading subset (h2-h4 by default)
                if (headings.wellStructured && this.config.createToC && this._inArray(HeadingSubset, level)) {
                    // create table of contents (ToC) if desired
                    if (this.config.createToC) {
                        this._newToCItem(item);
                    }
                }

                // iterate the count
                if (typeof headings.count[name] === 'undefined') {
                    headings.count[name] = 1;
                } else {
                    headings.count[name]++;
                }

                // add the object to the array
                headings.items.push(item);
            }
            return headings;
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
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;

            try {
                for (var _iterator2 = ids[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    var item = _step2.value;

                    PageIDs.push(item.getAttribute('id'));
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
            if (this._inArray(PageIDs, id)) {
                var root = id;
                var n = 0;
                do {
                    n++;
                    id = root + '-' + n;
                } while (this._inArray(PageIDs, id));
            }
            return id;
        }
    }, {
        key: '_sectionWrap',
        value: function _sectionWrap(el, item) {
            if (item.exclude && this.config.excludeAll) return true;

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
            var matched = this._nextUntilSameTag(el);

            matched.forEach(function (elem) {
                section.appendChild(elem);
            });

            if (prev) prev.parentNode.insertBefore(section, prev.nextSibling);
        }

        // collect all the elements from el to the next same tagName
        // borrowed from jQuery.nextUntil()

    }, {
        key: '_nextUntilSameTag',
        value: function _nextUntilSameTag(el) {
            var matched = [];
            var matchTag = el.tagName;
            matched.push(el);
            while ((el = el.nextSibling) && el.nodeType !== 9) {
                if (el.nodeType === 1) {
                    if (el.tagName === matchTag) break;
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
        key: '_newToCItem',
        value: function _newToCItem(item) {
            var li = this._createListItem(item);
            var depth = item.level - this.config.start;
            if (this._inArray(HeadingSubset, Level.previous)) Level.previousToc = Level.previous;
            var change = item.level - Level.previousToc;

            if (depth === 0) {
                Level.parent = this.toc;
            } else if (change > 0) {
                var ul = this.doc.createElement('ul');
                ul.className = this.config.tocClass + '--' + item.name;
                Level.parent.lastChild.appendChild(ul);
                Level.parent = ul;
            } else if (change < 0) {
                Level.parent = $(Level.parent).parents().eq(Math.abs(change));
            }
            Level.parent.appendChild(li);
        }
    }, {
        key: '_createListItem',
        value: function _createListItem(item) {
            if (item.exclude) return;
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