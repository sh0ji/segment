/**
 * --------------------------------------------------------------------------
 * Segment (v1.1.0): segment.js
 * Wrap headings and their contents in semantic section containers
 * by Evan Yamanishi
 * Licensed under MIT
 * --------------------------------------------------------------------------
 */

'use strict'

const NAME = 'segment'
const VERSION = '1.1.0'
const HEADINGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']
const DATA_LEVEL = 'data-level'

const Default = {
    debug: false,
    headingAnchor: true,
    autoWrap: true,
    startLevel: 1,
    excludeClass: 'segment-exclude',
    sectionClass: 'document-section',
    anchorClass: 'heading-link'
}

// errors borrowed from Khan Academy's tota11y library
// https://github.com/Khan/tota11y
const Error = {
    FIRST_NOT_H1(el, currentLvl) {
        return {
            title: 'First heading is not an <h1>.',
            description: `To give your document a proper structure for assistive technologies, it is important to lay out your headings beginning with an <h1>. The first heading was an <h${currentLvl}>.`,
            element: el
        }
    },
    NONCONSECUTIVE_HEADER(el, currentLvl, prevLvl) {
        let description = `This document contains an <h${currentLvl}> tag directly following an <h${prevLvl}>. In order to maintain a consistent outline of the page for assistive technologies, reduce the gap in the heading level by upgrading this tag to an <h${prevLvl+1}>`

        // Suggest upgrading the tag to the same level as `prevLvl` iff
        // `prevLvl` is not 1
        if (prevLvl !== 1) {
            description += ` or <h${prevLvl}>.`
        } else {
            description += '.'
        }

        return {
            title: `Nonconsecutive heading level used (h${prevLvl} → h${currentLvl}).`,
            description: description,
            element: el
        }
    },

    // additional errors not in tota11y
    NO_HEADINGS_FOUND() {
        return {
            title: 'No headings found.',
            description: 'Please ensure that all headings are properly tagged.'
        }
    },
    PRE_EXISTING_SECTION(el, currentLvl) {
        return {
            title: 'Pre-existing <section> tag',
            description: `The current <h${currentLvl}> is already the direct child of a <section> tag.`,
            element: el
        }
    },
    INVALID_DOCUMENT(debug) {
        let description = 'One or more headings did not pass validation.'

        // suggest turning on debugging
        if (!debug) {
            description += ' Try again with debugging on: {debug: true}.'
        }

        return {
            title: 'The heading structure is invalid.',
            description: description
        }
    }
}


class Segment {

    constructor(doc, config) {
        // doc must be a DOCUMENT_NODE (nodeType 9)
        if (doc.nodeType !== 9) {
            console.error('Valid document required.')
        } else {
            this.doc = doc
        }

        // build the configuration from defaults
        this.config = this._getConfig(config)

        // collect all the headings in the document
        this.headings = Array.from(this.doc.querySelectorAll(HEADINGS.join(',')))
            // post an error if none are found
        if (this.config.debug && this.headings.length === 0) {
            this._postError(Error.NO_HEADINGS_FOUND())
        }

        // validate the document
        this.validHeadings = this.validateDocument()
            // post an error if the document isn't valid
        if (!this.validHeadings) {
            this._postError(Error.INVALID_DOCUMENT(this.config.debug))
        }

        // collect all the ids in the document
        this.docIDs = this._getDocIDs()

        // automatically create section containers
        if (this.config.autoWrap && this.validHeadings) {
            this.sections = []
            this.headings.map((heading) => this.createSection(heading, (err, section) => {
                if (err) {
                    this._postError(err)
                } else {
                    this.sections.push(section)
                }
            }))
        }
    }


    // public

    // asynchronously validate a heading element
    // callback returns (error object, boolean valid)
    validateHeading(currentHead, prevHead, callback) {
        let currentLvl = this._getHeadingLevel(currentHead)
        let prevLvl = this._getHeadingLevel(prevHead)

        // first heading not h1
        if (!prevLvl && currentLvl !== 1) {
            if (this.config.debug) {
                callback(Error.FIRST_NOT_H1(currentHead, currentLvl))
            }

            // non-consecutive headings
        } else if (prevLvl && (currentLvl - prevLvl > 1)) {
            if (this.config.debug) {
                callback(Error.NONCONSECUTIVE_HEADER(currentHead, currentLvl, prevLvl))
            }
        }

        // everything checks out
        callback(null, true)
    }

    // synchronously validate the whole document
    validateDocument() {
        let prevHead = null
        let valid = []
        this.headings.map((heading) => {
            this.validateHeading(heading, prevHead, (err, result) => {
                if (err) {
                    this._postError(err)
                }
                valid.push(result)
            })
            prevHead = heading
        })
        return valid.every((v) => v)
    }

    // asynchronously create section containers
    // callback returns (error object, section element)
    createSection(heading, callback) {
        let item = this._buildItem(heading)
        if (item.level < this.config.startLevel) return

        let parent = heading.parentNode

        // check for a pre-existing section container
        if (parent.nodeName === 'SECTION' &&
            !parent.classList.contains(this.config.sectionClass)) {
            callback(Error.PRE_EXISTING_SECTION(heading, item.level))
        }

        // create the section container
        let section = this.doc.createElement('section')
        section.setAttribute('id', item.id)
        section.setAttribute(DATA_LEVEL, item.level)
        section.className = this.config.sectionClass

        // attach the section to the correct place in the DOM
        if (parent.getAttribute(DATA_LEVEL) == item.level) {
            parent.parentNode.insertBefore(section, parent.nextElementSibling)
        } else {
            parent.insertBefore(section, heading)
        }

        // populate the section element
        let matched = this._nextUntilSameTag(heading, item)
        matched.map((elem) => {
            section.appendChild(elem)
        })

        // replace the heading text with a non-tabbable anchor that
        // references the section
        if (this.config.headingAnchor) {
            let anchor = this.doc.createElement('a')
            anchor.setAttribute('href', `#${item.id}`)
            anchor.setAttribute('tabindex', -1)
            anchor.textContent = item.contents
            heading.innerHTML = anchor.outerHTML
            heading.className = this.config.anchorClass
        }
        callback(null, section)
    }


    // private

    _getConfig(config) {
        return Object.assign({}, Default, config)
    }

    _getDocIDs() {
        let idElements = Array.from(this.doc.querySelectorAll('[id]'))
        return idElements.map((el) => el.getAttribute('id'))
    }

    _getHeadingLevel(el) {
        let isHeading = (el) ? HEADINGS.includes(el.nodeName) : false
        return (isHeading) ? parseInt(el.nodeName.substr(1)) : null
    }

    _constructID(string) {
        let id = string.trim()
            // start with letter. remove apostrophes & quotes
            .replace(/^[^A-Za-z]*/, '').replace(/[‘’'“”"]/g, '')
            // replace all symbols with -. except at the end
            .replace(/[^A-Za-z0-9]+/g, '-').replace(/-$/g, '')
            // make it all lowercase
            .toLowerCase()

        // append a number if the id isn't unique
        if (this.docIDs.includes(id)) {
            let root = id
            let n = 0
            do {
                n++
                id = `${root}-${n}`
            } while (this.docIDs.includes(id))
        }
        return id
    }

    _buildItem(el) {
        return {
            contents: el.textContent,
            excluded: el.classList.contains(this.config.excludeClass),
            id: this._constructID(el.textContent),
            level: this._getHeadingLevel(el)
        }
    }

    // collect all the elements from el to the next same tagName
    // borrowed from jQuery.nextUntil()
    _nextUntilSameTag(el) {
        let original = {
            nodeName: el.nodeName,
            level: this._getHeadingLevel(el)
        }
        let matched = []
        matched.push(el)
        while ((el = el.nextSibling) && el.nodeType !== 9) {
            if (el.nodeType === 1) {
                let level = this._getHeadingLevel(el)
                    // stop on same tag or lower heading level
                if (el.nodeName === original.nodeName || (level && level < original.level)) break
                matched.push(el)
            }
        }
        return matched
    }

    // ^ REFACTORED ^

    _postError(error) {
        console.warn(error.title)
        console.warn(error.description)
        if (error.element) {
            console.warn(error.element)
        }
    }
}

export default Segment
