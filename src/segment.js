/**
 * --------------------------------------------------------------------------
 * Segment (v1.0.4): segment.js
 * Validate and improve the semantics of an HTML document
 * by Evan Yamanishi
 * Licensed under MIT
 * --------------------------------------------------------------------------
 */

'use strict'

const NAME = 'segment'
const VERSION = '1.0.4'
const NAMESPACE = 'nest'
const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

// initialize private(ish) variables
const HeadingSubset = []
const PageIDs = []
const Level = {
    current: 0,
    previous: 0,
    previousEl: null,
    parent: null
}

const Default = {
    createToC: true,
    excludeClassSection: 'sec-exclude',
    excludeClassToc: 'toc-exclude',
    start: 1,
    end: 6,
    sectionClass: 'section-container',
    sectionWrap: true,
    tocClass: `${NAMESPACE}-contents`
}

// errors borrowed from Khan Academy's tota11y library
// https://github.com/Khan/tota11y
const Error = {
    FIRST_NOT_H1(level, el) {
        return {
            title: 'First heading is not an <h1>.',
            description: `To give your document a proper structure for assistive technologies, it is important to lay out your headings beginning with an <h1>. The first heading was an <h${level}>.`,
            element: el
        }
    },
    NONCONSECUTIVE_HEADER(prevLevel, currLevel, el) {
        let description = `This document contains an <h${currLevel}> tag directly following an <h${prevLevel}>. In order to maintain a consistent outline of the page for assistive technologies, reduce the gap in the heading level by upgrading this tag to an <h${prevLevel+1}>`

        // Suggest upgrading the tag to the same level as `prevLevel` iff
        // `prevLevel` is not 1
        if (prevLevel !== 1) {
            description += ` or <h${prevLevel}>.`
        } else {
            description += '.'
        }

        return {
            title: `Nonconsecutive heading level used (h${prevLevel} → h${currLevel}).`,
            description: description,
            element: el
        }
    },
    // additional errors (not in tota11y)
    NO_HEADINGS_FOUND() {
        return {
            title: 'No headings found.',
            description: 'Please ensure that all headings are properly tagged.'
        }
    },
    PRE_EXISTING_SECTION(level, el) {
        return {
            title: 'Pre-existing <section> tag',
            description: `The current h${level} is already the child of a <section> tag.`,
            element: el,
            warning: true
        }
    }
}


class Segment {

    constructor(doc, config) {
        if (typeof config === 'string') {
            if (data[config] === undefined) {
                throw new Error(`No method named "${config}"`)
            }
            this[config]()
        } else {
            this.config = this._getConfig(config)
        }

        this.doc = doc

        // get all the ids on the page so we can construct unique ones
        this._getPageIDs()

        // construct a subset of headings (e.g. h2-h4) based on
        // start and end values specified in config
        this._createHeadingSubset()

        // initialize the table of contents (ToC)
        if (this.config.createToC) this.toc = this._initToC()

        // build the heading object
        this.headings = this._getHeadings()
        if (this.headings.length === 0) this._postError(Error.NO_HEADINGS_FOUND())
    }


    // public


    // private

    // overwrite default options with supplied options
    _getConfig(config) {
        return Object.assign({}, Default, config)
    }

    _getHeadings() {
        let headings = {}
        let c = this._headingCount()
        headings.count = c.heads
        headings.length = c.total

        headings.items = this._getHeadingItems()

        return headings
    }

    _headingCount() {
        let heads = {}
        for (let heading of HEADINGS) {
            heads[heading] = (heading).length
        }
        return heads
    }

    _validateHeading(item, el) {
        // first heading not h1
        if (Level.previous === 0 && item.levelAbsolute !== 1) {
            this._postError(Error.FIRST_NOT_H1(item.levelAbsolute, el))
            return false

        // non-consecutive headings
        } else if (Level.previous !== 0 && item.levelAbsolute - Level.previous > 1) {
            this._postError(Error.NONCONSECUTIVE_HEADER(Level.previous, item.levelAbsolute, el))
            return false
        }
        return true
    }

    _postError(err) {
        let severity = err.warning ? 'warning' : 'error'
        let errString = `HEADING ${severity.toUpperCase()}\nType: ${err.title}\nInfo: ${err.description}`
        if (err.element) {
            let output = `${errString}\nProblem heading:`
            if (err.warning) {
                console.warn(output, err.element)
            } else {
                console.error(output, err.element)
            }
            err.element.className = `${severity}--heading`
        } else {
            console.error(errString)
        }
    }

    _contains(array, value) {
        return array.indexOf(value) >= 0
    }

    _getHeadings() {
        let headings = this.doc.querySelectorAll(HEADINGS.toString())

        // initialize the headings object
        let headingMeta = {
            count: {},
            items: [],
            length: headings.length,
            wellStructured: true
        }

        // iterate over every heading in DOM order
        for (let heading of headings) {

            let headingClasses = heading.getAttribute('class') || ''

            // create object to hold heading metadata
            let item = {
                classString: headingClasses,
                contents: heading.textContent,
                excludeSection: this._contains(headingClasses, this.config.excludeClassSection),
                excludeToc: this._contains(headingClasses, this.config.excludeClassToc),
                id: this._constructID(heading.textContent),
                levelAbsolute: parseInt(heading.nodeName.substr(1)),
                levelRelative: parseInt(heading.nodeName.substr(1)) - this.config.start + 1,
                tag: heading.tagName.toLowerCase()
            }

            // move the level iterators forward
            Level.previous = Level.current
            Level.current = item.levelAbsolute

            // validate the heading
            item.valid = this._validateHeading(item, heading)

            // one bad heading makes the whole document poorly structured
            if (!item.valid) headingMeta.wellStructured = false

            // proceed if the heading is valid
            if (headingMeta.wellStructured) {
                // wrap in sections
                // specified in the config
                if (this.config.sectionWrap &&
                    // current heading level is >= the specified start level
                    item.levelAbsolute >= this.config.start &&
                    // the current heading shouldn't be excluded
                    !item.excludeSection) {
                    this._sectionWrap(heading, item)
                }

                // create table of contents using the specified heading subset (h1-h6 by default)
                if (this.config.createToC &&
                    this._contains(HeadingSubset, item.levelAbsolute) &&
                    !item.excludeToc) {
                    this._addTocItem(item)
                }

                // iterate the count
                if (typeof headingMeta.count[item.tag] === 'undefined') {
                    headingMeta.count[item.tag] = 1
                } else {
                    headingMeta.count[item.tag]++
                }
            }

            // add the object to the array
            headingMeta.items.push(item)
        }
        delete this.doc
        return headingMeta
    }

    _createHeadingSubset() {
        HEADINGS.forEach((h, i) => {
            let level = i + 1
            if (this.config.start <= level || typeof this.config.start === 'undefined') {
                if (this.config.end >= level || typeof this.config.end === 'undefined') {
                    HeadingSubset.push(level)
                }
            }
        })
        return true
    }

    _getPageIDs() {
        let ids = this.doc.querySelectorAll('[id]')
        for (let item of ids) {
            PageIDs.push(item.getAttribute('id'))
        }
        return true
    }

    _constructID(string) {
        let id = string.trim()
            // start with letter, remove apostrophes & quotes
            .replace(/^[^A-Za-z]*/, '').replace(/[‘’'“”"]/g, '')
            // replace all symbols with - except at the end
            .replace(/[^A-Za-z0-9]+/g, '-').replace(/-$/g, '').toLowerCase()

        // append a number if the id isn't unique
        if (this._contains(PageIDs, id)) {
            let root = id
            let n = 0
            do {
                n++
                id = `${root}-${n}`
            } while (this._contains(PageIDs, id))
        }
        return id
    }

    _sectionWrap(el, item) {

        if (el.parentElement.tagName === 'SECTION' &&
            el.parentElement.className !== this.config.sectionClass) {
            this._postError(Error.PRE_EXISTING_SECTION(item.levelAbsolute, el))
        }

        // create the section container
        let section = this.doc.createElement('section')
        section.setAttribute('id', item.id)
        section.dataset.level = item.levelRelative
        section.className = this.config.sectionClass

        // attach the section to the correct place in the DOM
        let parent = el.parentNode
        if (parseInt(parent.dataset.level) === item.levelRelative) {
            parent.parentNode.insertBefore(section, parent.nextElementSibling)
        } else {
            parent.insertBefore(section, el)
        }

        // populate the section element
        let matched = this._nextUntilSameTag(el, item)
        matched.forEach((elem) => {
            section.appendChild(elem)
        })

        // replace the heading text with a non-tabbable anchor that
        // references the section
        let anchor = this.doc.createElement('a')
        anchor.setAttribute('href', `#${item.id}`)
        anchor.setAttribute('tabindex', -1)
        anchor.textContent = item.contents
        el.innerHTML = anchor.outerHTML
        el.className = 'heading-link'
    }

    // collect all the elements from el to the next same tagName
    // borrowed from jQuery.nextUntil()
    _nextUntilSameTag(el, item) {
        let matched = []
        matched.push(el)
        while ((el = el.nextSibling) && el.nodeType !== 9) {
            let level = parseInt(el.nodeName.substr(1)) || null
            if (el.nodeType === 1) {
                if (el.nodeName === item.tag || (level && level < item.levelAbsolute)) break
                matched.push(el)
            }
        }
        return matched
    }

    _initToC() {
        let toc = this.doc.createElement('ul')
        toc.className = `${this.config.tocClass} ${this.config.tocClass}--h${this.config.start}`
        return toc
    }

    _addTocItem(item) {
        let li = this._createListItem(item)
        let depth = item.levelAbsolute - this.config.start
        if (this._contains(HeadingSubset, Level.previous)) Level.previousEl = Level.previous
        let change = item.levelAbsolute - Level.previousEl

        if (depth === 0) {
            Level.parent = this.toc
        } else if (change > 0) {
            let ul = this.doc.createElement('ul')
            ul.className = `${this.config.tocClass}--${item.tag}`
            Level.parent.lastChild.appendChild(ul)
            Level.parent = ul
        } else if (change < 0) {
            let i = 0
            while (i < Math.abs(change)) {
                Level.parent = Level.parent.parentElement
                if (Level.parent.nodeName === 'UL') i++
            }
        }
        Level.parent.appendChild(li)
    }

    _createListItem(item) {
        if (item.excludeToc) return
        let li = this.doc.createElement('li')
        li.className = `${this.config.tocClass}__item`
        let tocLink = this.doc.createElement('a')
        tocLink.setAttribute('href', `#${item.id}`)
        tocLink.className = `${this.config.tocClass}__link`
        tocLink.textContent = item.contents

        li.appendChild(tocLink)
        return li
    }


    // static
    static init(doc, config) {
        return new Segment(doc, config)
    }

}

export default Segment
