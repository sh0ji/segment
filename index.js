/**
 * html-segment
 * Wrap headings and their contents in semantic section containers
 * @author Evan Yamanishi
 * @license MIT
 */

const WebId = require('web-id');
const assert = require('assert');

const HEADINGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
const Err = {
    FIRST_NOT_H1(el, currentLvl) {
        return {
            title: 'First heading is not an <h1>.',
            description: `To give your document a proper structure for assistive technologies, it is important to lay out your headings beginning with an <h1>. The first heading was an <h${currentLvl}>.`,
            element: el,
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
            element: el,
        };
    },

    // additional errors not in tota11y
    NO_HEADINGS_FOUND() {
        return {
            title: 'No headings found.',
            description: 'Please ensure that all headings are properly tagged.',
        };
    },
    PRE_EXISTING_SECTION(el, currentLvl) {
        return {
            title: 'Pre-existing <section> tag',
            description: `The current <h${currentLvl}> is already the direct child of a <section> tag.`,
            element: el,
        };
    },
};

class Segment {
    constructor(doc) {
        this.doc = doc || document; // eslint-disable-line no-undef
        this.errors = [];
    }

    get headings() {
        return Array.from(this.doc.querySelectorAll(HEADINGS.join(',')));
    }

    get ids() {
        return Array.from(this.doc.querySelectorAll('[id]')).map(el => el.id);
    }

    get validStructure() {
        if (this.headings.length === 0) {
            this.addError(Err.NO_HEADINGS_FOUND());
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
            this.addError(Err.FIRST_NOT_H1(currentEl, currentLvl));
        }

        if (currentLvl - prevLvl > 1) {
            valid = false;
            this.addError(Err.NONCONSECUTIVE_HEADER(currentEl, currentLvl, prevLvl));
        }
        return valid;
    }

    addError(err) {
        this.errors.push(err);
    }

    logErrors() {
        /* eslint-disable no-console */
        console.error('The heading structure is invalid.');
        this.errors.forEach((err) => {
            console.warn(`${err.title}\n${err.description}`);
        });
        /* eslint-enable no-console */
    }

    segment() {
        if (this.validStructure) {
            this.headings.forEach(this.wrapHeading);
        } else {
            this.logErrors();
        }
    }

    wrapHeading(heading) {
        return new Promise((resolve, reject) => {
            const section = this.doc.createElement('section');
            section.id = this.idFromString(heading.textContent);
            section.className = this.sectionClass;

            try {
                this.nextUntilSameTag(heading)
                    .forEach(sib => section.appendChild(sib));
            } catch (err) {
                reject(err);
            }

            const anchor = this.doc.createElement('a');
            anchor.href = `#${section.id}`;
            anchor.class = this.anchorClass;
            anchor.textContent = heading.textContent;

            heading.innerHtml = anchor; // eslint-disable-line no-param-reassign
            resolve(section);
        });
    }

    idFromString(str) {
        const id = new WebId(str);
        while (this.ids.includes(id.iter)) {
            id.iterate();
        }
        this.ids.push(id.iter);
        return id.iter;
    }

    static nextUntilSameTag(el) {
        const orig = {
            nodeName: el.nodeName,
            lvl: Segment.headingLevel(el),
        };
        const matched = [];
        matched.push(el);
        let elem = el;
        while ((elem = el.nextSibling) && elem.nodeType !== 9) {    // eslint-disable-line
            if (elem.nodeType === 1) {
                const lvl = Segment.headingLevel(elem);
                if (elem.nodeName === orig.nodeName || (lvl && lvl < orig.lvl)) {
                    break;
                }
                matched.push(elem);
            }
        }
        return matched;
    }

    static headingLevel(el) {
        assert(/h[1-6]/i.test(el.tagName), `${el.tagName} is not a heading element.`);
        return Number(el.tagName.charAt(1));
    }
}

module.exports = Segment;
