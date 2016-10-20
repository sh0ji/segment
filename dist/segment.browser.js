(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.htmlSegment = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
/**
 * --------------------------------------------------------------------------
 * Segment (v1.1.0): segment.js
 * Wrap headings and their contents in semantic section containers
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
var VERSION = '1.1.0';
var HEADINGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
var DATA_LEVEL = 'data-level';

var Default = {
    debug: false,
    headingAnchor: true,
    autoWrap: true,
    startLevel: 1,
    excludeClass: 'segment-exclude',
    sectionClass: 'document-section',
    anchorClass: 'heading-link'
};

// errors borrowed from Khan Academy's tota11y library
// https://github.com/Khan/tota11y
var Error = {
    FIRST_NOT_H1: function FIRST_NOT_H1(el, currentLvl) {
        return {
            title: 'First heading is not an <h1>.',
            description: 'To give your document a proper structure for assistive technologies, it is important to lay out your headings beginning with an <h1>. The first heading was an <h' + currentLvl + '>.',
            element: el
        };
    },
    NONCONSECUTIVE_HEADER: function NONCONSECUTIVE_HEADER(el, currentLvl, prevLvl) {
        var description = 'This document contains an <h' + currentLvl + '> tag directly following an <h' + prevLvl + '>. In order to maintain a consistent outline of the page for assistive technologies, reduce the gap in the heading level by upgrading this tag to an <h' + (prevLvl + 1) + '>';

        // Suggest upgrading the tag to the same level as `prevLvl` iff
        // `prevLvl` is not 1
        if (prevLvl !== 1) {
            description += ' or <h' + prevLvl + '>.';
        } else {
            description += '.';
        }

        return {
            title: 'Nonconsecutive heading level used (h' + prevLvl + ' \u2192 h' + currentLvl + ').',
            description: description,
            element: el
        };
    },


    // additional errors not in tota11y
    NO_HEADINGS_FOUND: function NO_HEADINGS_FOUND() {
        return {
            title: 'No headings found.',
            description: 'Please ensure that all headings are properly tagged.'
        };
    },
    PRE_EXISTING_SECTION: function PRE_EXISTING_SECTION(el, currentLvl) {
        return {
            title: 'Pre-existing <section> tag',
            description: 'The current <h' + currentLvl + '> is already the direct child of a <section> tag.',
            element: el
        };
    },
    INVALID_DOCUMENT: function INVALID_DOCUMENT(debug) {
        var description = 'One or more headings did not pass validation.';

        // suggest turning on debugging
        if (!debug) {
            description += ' Try again with debugging on: {debug: true}.';
        }

        return {
            title: 'The heading structure is invalid.',
            description: description
        };
    }
};

var Segment = function () {
    function Segment(doc, config) {
        var _this = this;

        _classCallCheck(this, Segment);

        // doc must be a DOCUMENT_NODE (nodeType 9)
        if (doc.nodeType !== 9) {
            console.error('Valid document required.');
        } else {
            this.doc = doc;
        }

        // build the configuration from defaults
        this.config = this._getConfig(config);

        // collect all the headings in the document
        this.headings = Array.from(this.doc.querySelectorAll(HEADINGS.join(',')));
        // post an error if none are found
        if (this.config.debug && this.headings.length === 0) {
            this._postError(Error.NO_HEADINGS_FOUND());
        }

        // validate the document
        this.validHeadings = this.validateDocument();
        // post an error if the document isn't valid
        if (!this.validHeadings) {
            this._postError(Error.INVALID_DOCUMENT(this.config.debug));
        }

        // collect all the ids in the document
        this.docIDs = this._getDocIDs();

        // automatically create section containers
        if (this.config.autoWrap && this.validHeadings) {
            this.sections = [];
            this.headings.map(function (heading) {
                return _this.createSection(heading, function (err, section) {
                    if (err) {
                        _this._postError(err);
                    } else {
                        _this.sections.push(section);
                    }
                });
            });
        }
    }

    // public

    // asynchronously validate a heading element
    // callback returns (error object, boolean valid)


    _createClass(Segment, [{
        key: 'validateHeading',
        value: function validateHeading(currentHead, prevHead, callback) {
            var currentLvl = this._getHeadingLevel(currentHead);
            var prevLvl = this._getHeadingLevel(prevHead);

            // first heading not h1
            if (!prevLvl && currentLvl !== 1) {
                if (this.config.debug) {
                    callback(Error.FIRST_NOT_H1(currentHead, currentLvl));
                }

                // non-consecutive headings
            } else if (prevLvl && currentLvl - prevLvl > 1) {
                if (this.config.debug) {
                    callback(Error.NONCONSECUTIVE_HEADER(currentHead, currentLvl, prevLvl));
                }
            }

            // everything checks out
            callback(null, true);
        }

        // synchronously validate the whole document

    }, {
        key: 'validateDocument',
        value: function validateDocument() {
            var _this2 = this;

            var prevHead = null;
            var valid = [];
            this.headings.map(function (heading) {
                _this2.validateHeading(heading, prevHead, function (err, result) {
                    if (err) {
                        _this2._postError(err);
                    }
                    valid.push(result);
                });
                prevHead = heading;
            });
            return valid.every(function (v) {
                return v;
            });
        }

        // asynchronously create section containers
        // callback returns (error object, section element)

    }, {
        key: 'createSection',
        value: function createSection(heading, callback) {
            var item = this._buildItem(heading);
            if (item.level < this.config.startLevel) return;

            var parent = heading.parentNode;

            // check for a pre-existing section container
            if (parent.nodeName === 'SECTION' && !parent.classList.contains(this.config.sectionClass)) {
                callback(Error.PRE_EXISTING_SECTION(heading, item.level));
            }

            // create the section container
            var section = this.doc.createElement('section');
            section.setAttribute('id', item.id);
            section.setAttribute(DATA_LEVEL, item.level);
            section.className = this.config.sectionClass;

            // attach the section to the correct place in the DOM
            if (parent.getAttribute(DATA_LEVEL) == item.level) {
                parent.parentNode.insertBefore(section, parent.nextElementSibling);
            } else {
                parent.insertBefore(section, heading);
            }

            // populate the section element
            var matched = this._nextUntilSameTag(heading, item);
            matched.map(function (elem) {
                section.appendChild(elem);
            });

            // replace the heading text with a non-tabbable anchor that
            // references the section
            if (this.config.headingAnchor) {
                var anchor = this.doc.createElement('a');
                anchor.setAttribute('href', '#' + item.id);
                anchor.setAttribute('tabindex', -1);
                anchor.textContent = item.contents;
                heading.innerHTML = anchor.outerHTML;
                heading.className = this.config.anchorClass;
            }
            callback(null, section);
        }

        // private

    }, {
        key: '_getConfig',
        value: function _getConfig(config) {
            return Object.assign({}, Default, config);
        }
    }, {
        key: '_getDocIDs',
        value: function _getDocIDs() {
            var idElements = Array.from(this.doc.querySelectorAll('[id]'));
            return idElements.map(function (el) {
                return el.getAttribute('id');
            });
        }
    }, {
        key: '_getHeadingLevel',
        value: function _getHeadingLevel(el) {
            var isHeading = el ? HEADINGS.includes(el.nodeName) : false;
            return isHeading ? parseInt(el.nodeName.substr(1)) : null;
        }
    }, {
        key: '_constructID',
        value: function _constructID(string) {
            var id = string.trim()
            // start with letter. remove apostrophes & quotes
            .replace(/^[^A-Za-z]*/, '').replace(/[‘’'“”"]/g, '')
            // replace all symbols with -. except at the end
            .replace(/[^A-Za-z0-9]+/g, '-').replace(/-$/g, '')
            // make it all lowercase
            .toLowerCase();

            // append a number if the id isn't unique
            if (this.docIDs.includes(id)) {
                var root = id;
                var n = 0;
                do {
                    n++;
                    id = root + '-' + n;
                } while (this.docIDs.includes(id));
            }
            return id;
        }
    }, {
        key: '_buildItem',
        value: function _buildItem(el) {
            return {
                contents: el.textContent,
                excluded: el.classList.contains(this.config.excludeClass),
                id: this._constructID(el.textContent),
                level: this._getHeadingLevel(el)
            };
        }

        // collect all the elements from el to the next same tagName
        // borrowed from jQuery.nextUntil()

    }, {
        key: '_nextUntilSameTag',
        value: function _nextUntilSameTag(el) {
            var original = {
                nodeName: el.nodeName,
                level: this._getHeadingLevel(el)
            };
            var matched = [];
            matched.push(el);
            while ((el = el.nextSibling) && el.nodeType !== 9) {
                if (el.nodeType === 1) {
                    var level = this._getHeadingLevel(el);
                    // stop on same tag or lower heading level
                    if (el.nodeName === original.nodeName || level && level < original.level) break;
                    matched.push(el);
                }
            }
            return matched;
        }

        // ^ REFACTORED ^

    }, {
        key: '_postError',
        value: function _postError(error) {
            console.warn(error.title);
            console.warn(error.description);
            if (error.element) {
                console.warn(error.element);
            }
        }
    }]);

    return Segment;
}();

exports.default = Segment;
module.exports = exports['default'];

},{}]},{},[1])(1)
});