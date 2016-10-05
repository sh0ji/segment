/**
 * --------------------------------------------------------------------------
 * Segment (v1.0.0): segment.js
 * Validate and improve the semantics of an HTML document
 * by Evan Yamanishi
 * Licensed under GPL-3.0
 * --------------------------------------------------------------------------
 */

'use strict'

const NAME = 'segment'
const VERSION = '1.0.0'
const NAMESPACE = 'nest'
const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

// initialize private(ish) variables
const HeadingSubset = []
const PageIDs = []
const Level = {
    current: 0,
    previous: 0,
    previousToc: null,
    parent: null
}

const Default = {
    createToC: true,
    excludeClass: 'toc-exclude',
    excludeAll: true,
    tocClass: `${NAMESPACE}-contents`,
    start: 2,
    end: 4,
    sectionClass: 'section-container',
    sectionWrap: true
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
        if (Level.previous === 0 && item.level !== 1) {
            this._postError(Error.FIRST_NOT_H1(item.level, el))
            return false

            // non-consecutive headings
        } else if (Level.previous !== 0 && item.level - Level.previous > 1) {
            this._postError(Error.NONCONSECUTIVE_HEADER(Level.previous, item.level, el))
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

    _inArray(array, value) {
        return array.indexOf(value) >= 0
    }

    _getHeadings() {
        let heads = this.doc.querySelectorAll(HEADINGS.toString())

        // initialize the headings object
        let headings = {
            count: {},
            items: [],
            length: heads.length,
            wellStructured: true
        }

        // iterate over every heading in DOM order
        for (let i in heads) {
            if (i === 'length') return true
            let heading = heads[i]

            // create item object
            let item = {
                name: heading.tagName.toLowerCase(),
                level: parseInt(heading.nodeName.substr(1)),
                id: this._constructID(heading.textContent),
                classList: heading.getAttribute('class') || null,
                exclude: heading.classList.contains(this.config.excludeClass),
                contents: heading.textContent
            }

            // move the level iterators forward
            Level.previous = Level.current
            Level.current = item.level

            // validate the heading
            let valid = this._validateHeading(item, heading)

            // one invalid heading makes the whole document poorly structured
            if (!valid) headings.wellStructured = false

            // wrap in sections if desired
            if (headings.wellStructured &&
                this.config.sectionWrap &&
                item.level >= this.config.start) {
                this._sectionWrap(heading, item)
            }

            // create table of contents using the heading subset (h2-h4 by default)
            if (headings.wellStructured &&
                this.config.createToC &&
                this._inArray(HeadingSubset, item.level)) {
                // create table of contents (ToC) if desired
                if (this.config.createToC) {
                    this._newToCItem(item)
                }
            }

            // iterate the count
            if (typeof headings.count[item.name] === 'undefined') {
                headings.count[item.name] = 1
            } else {
                headings.count[item.name]++
            }

            // add the object to the array
            headings.items.push(item)
        }
        return headings
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
        if (this._inArray(PageIDs, id)) {
            let root = id
            let n = 0
            do {
                n++
                id = `${root}-${n}`
            } while (this._inArray(PageIDs, id))
        }
        return id
    }

    _sectionWrap(el, item) {
        if (item.exclude && this.config.excludeAll) return true

        if (el.parentElement.tagName === 'SECTION' &&
            el.parentElement.className !== this.config.sectionClass) {
            this._postError(Error.PRE_EXISTING_SECTION(item.level, el))
        }

        // create the section container
        let section = this.doc.createElement('section')
        section.setAttribute('id', item.id)
        section.className = this.config.sectionClass

        // replace the heading text with a non-tabbable anchor that
        // references the section
        let anchor = this.doc.createElement('a')
        anchor.setAttribute('href', `#${item.id}`)
        anchor.setAttribute('tabindex', -1)
        anchor.textContent = item.contents
        el.innerHTML = anchor.outerHTML
        el.className = 'heading-link'

        let prev = el.previousSibling
        let matched = this._nextUntilSameTag(el, item)

        matched.forEach((elem) => {
            section.appendChild(elem)
        })

        if (prev) prev.parentNode.insertBefore(section, prev.nextSibling)
    }

    // collect all the elements from el to the next same tagName
    // borrowed from jQuery.nextUntil()
    _nextUntilSameTag(el, item) {
        let matched = []
        matched.push(el)
        while ((el = el.nextSibling) && el.nodeType !== 9) {
            let level = parseInt(el.nodeName.substr(1)) || null
            if (el.nodeType === 1) {
                if (el.nodeName === item.name || (level && level < item.level)) break
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

    _newToCItem(item) {
        let li = this._createListItem(item)
        let depth = item.level - this.config.start
        if (this._inArray(HeadingSubset, Level.previous)) Level.previousToc = Level.previous
        let change = item.level - Level.previousToc

        if (depth === 0) {
            Level.parent = this.toc
        } else if (change > 0) {
            let ul = this.doc.createElement('ul')
            ul.className = `${this.config.tocClass}--${item.name}`
            Level.parent.lastChild.appendChild(ul)
            Level.parent = ul
        } else if (change < 0) {
            Level.parent = $(Level.parent).parents().eq(Math.abs(change))
        }
        Level.parent.appendChild(li)
    }

    _createListItem(item) {
        if (item.exclude) return
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
