/**
 * html-segment
 * Wrap headings and their contents in semantic section containers
 * @author Evan Yamanishi
 * @license MIT
 */

const WebId = require('web-id');
const EventEmitter = require('events').EventEmitter;

const HEADINGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
const Err = {
    // errors adapted from tota11y
    FIRST_NOT_H1(el, currentLvl) {
        return {
            title: 'First heading is not an <h1>.',
            description: `To give your document a proper structure for assistive technologies, it is important to lay out your headings beginning with an <h1>. The first heading was an <h${currentLvl}>.`,
            ref: el.outerHTML
        };
    },
    NONCONSECUTIVE_HEADER(el, currentLvl, prevLvl) {
        let desc = `This document contains an <h${currentLvl}> tag directly following an <h${prevLvl}>. In order to maintain a consistent outline of the page for assistive technologies, reduce the gap in the heading level by upgrading this tag to an <h${prevLvl + 1}>`;

        // Suggest upgrading the tag to the same level as `prevLvl` iff
        // `prevLvl` is not 1
        if (prevLvl !== 1) {
            desc += ` or <h${prevLvl}>.`;
        } else {
            desc += '.';
        }

        return {
            title: `Nonconsecutive heading level used (h${prevLvl} → h${currentLvl}).`,
            description: desc,
            ref: el.outerHTML
        };
    },

    // additional errors not in tota11y
    NO_HEADINGS_FOUND() {
        return {
            title: 'No headings found.',
            description: 'Please ensure that all headings are properly tagged.'
        };
    },
    PRE_EXISTING_SECTION(el, currentLvl) {
        return {
            title: 'Pre-existing <section> tag',
            description: `The current <h${currentLvl}> is already the direct child of a <section> tag.`,
            element: el.outerHTML
        };
    },
    LONG_HEADING(id, maxLength) {
        return {
            title: 'Unusually long heading.',
            description: `The heading text is over ${maxLength} characters long.`,
            ref: id
        };
    }
};

const Default = {
    sectionClass: 'doc-section',
    anchorClass: 'section-link',
    maxLength: 125
};

class Segment extends EventEmitter {
    constructor(doc, config) {
        super();
        this.doc = doc || document; // eslint-disable-line no-undef
        this.config = config || {};
        this.errors = [];
        this.sections = [];
    }

    get sectionClass() {
        return this.config.sectionClass || Default.sectionClass;
    }

    get anchorClass() {
        return this.config.anchorClass || Default.anchorClass;
    }

    get maxLength() {
        return this.config.maxLength || Default.maxLength;
    }

    get headings() {
        return Array.from(this.doc.querySelectorAll(HEADINGS.join(',')));
    }

    get ids() {
        return Array.from(this.doc.querySelectorAll('[id]')).map(el => el.id);
    }

    get validStructure() {
        if (this.headings.length === 0) {
            this.handleError(Err.NO_HEADINGS_FOUND());
            return false;
        }

        let prev;
        return this.headings.map((el) => {
            const valid = this.compareHeadings(el, prev);
            prev = el;
            return valid;
        }).every(v => v);
    }

    compareHeadings(currentEl, prevEl) {
        const currentLvl = Segment.headingLevel(currentEl);
        const prevLvl = (prevEl) ? Segment.headingLevel(prevEl) : 0;

        let valid = true;
        if (currentLvl !== 1 && !prevLvl) {
            valid = false;
            this.handleError(Err.FIRST_NOT_H1(currentEl, currentLvl));
        }

        if (currentLvl - prevLvl > 1) {
            valid = false;
            this.handleError(Err.NONCONSECUTIVE_HEADER(currentEl, currentLvl, prevLvl));
        }
        return valid;
    }

    segment() {
        if (this.validStructure) {
            this.headings.forEach((el) => {
                const section = this.wrapHeading(el);
                this.emit('segment', section);
                this.sections.push(section.id);
            });
            this.emit('segmented');
        }
    }

    wrapHeading(heading) {
        try {
            const section = this.doc.createElement('section');
            section.id = this.idFromString(heading.textContent);
            section.className = this.sectionClass;

            const parent = heading.parentNode;
            if (parent.nodeName.toUpperCase() === 'SECTION' &&
                parent.id === section.id) {
                const lvl = Segment.headingLevel(heading);
                this.handleError(Err.PRE_EXISTING_SECTION(heading, lvl));
            }

            try {
                Segment.nextUntilSameHead(heading)
                    .forEach(sib => section.appendChild(sib));
                parent.insertBefore(section, heading);
            } catch (err) {
                this.handleError(err);
            }

            const anchor = this.doc.createElement('a');
            anchor.href = `#${section.id}`;
            anchor.class = this.anchorClass;
            anchor.textContent = heading.textContent;

            while (heading.firstChild) {
                heading.firstChild.remove();
            }
            heading.appendChild(anchor);
            section.insertBefore(heading, section.firstChild);
            return section;
        } catch (err) {
            this.handleError(err);
            return err;
        }
    }

    idFromString(str) {
        const id = new WebId(str);
        while (this.ids.includes(id.iter)) {
            id.iterate();
        }
        let newId = id.iter;
        if (id.iter.length > this.maxLength) {
            newId = newId.substring(0, this.maxLength);
            this.handleError(Err.LONG_HEADING(newId, this.maxLength));
        }
        this.ids.push(newId);
        return newId;
    }

    handleError(err) {
        const error = (err.constructor === Object) ? Segment.createError(err) : err;
        this.emit('error', error);
        this.errors.push(error.message);
    }

    static createError(err) {
        let message = `${err.title} ${err.description}`;
        if (err.ref) {
            message += `\nReference: ${err.ref}`;
        }
        return new Error(message);
    }

    /**
     * Get an array of sibling elements between the current element and the next
     * same tag (e.g. all elements between H2s)
     * Does not include the current element or the next same tag
     * @param {Object} el - An element node (Node of .nodeType ELEMENT_NODE)
     * @return {Array}
     */
    static nextUntilSameHead(el) {
        const lvl = Segment.headingLevel(el);
        const matched = [];
        let next = el;
        while ((next = next.nextSibling) && next.nodeType !== 9) { // eslint-disable-line
            if (next.nodeType === 1) {
                if (next.nodeName === el.nodeName ||
                    (Segment.headingLevel(next) < lvl)) {
                    break;
                }
                matched.push(next);
            }
        }
        return matched;
    }

    static headingLevel(el) {
        return Number(el.tagName.charAt(1)) || 10;
    }
}

module.exports = Segment;
