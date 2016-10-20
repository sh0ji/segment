# (html-)segment

Wrap headings and their contents in semantic section containers.

## Usage

Segment can either be used in the browser (`segment.browser.js`), as a module or preprocessing tool (`segment.module.js`).

### Browser

Simply add `segment.browser.js` as a script in the page you want to segment.

```html
<body>
    ...page contents...
    <script src="segment.browser.js" type="text/javascript"></script>
</body>
```

The browser version attaches the segment class to the window object as `htmlSegment`, allowing you to initialize it with `new htmlSegment(document[, config])`. Pass it the document object and an optional configuration object.

```javascript
// e.g. main.js
let segment = new htmlSegment(document)
```

By default, this will automatically wrap all headings and their contents in `<section>` containers.

### Module

Install with [yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/).

```sh
$ yarn add html-segment --dev
```

Include it in your module:

```javascript
// ES6
import segment from 'html-segment'

// ES5
var segment = require('html-segment')
```

This will import the `dist/segment.module.js` version.

## Options


## Preprocessing

Segment can also be used to alter static documents in a backend environment like node.js. Initialization works differently in this scenario since there isn't a window or document object to use.

### jsdom Example

This example creates a document object using [jsdom](https://github.com/tmpvar/jsdom), processes it with html-segment, and then saves the result as a new html file.

```javascript
// ES6 & Node.js
import fs from 'fs'
import path from 'path'
import jsdom from 'jsdom'

// equivalent to `const htmlSegment = require('html-segment')`
import htmlSegment from 'html-segment'

const dirs = {
    input: './documents/input',
    output: './documents/output'
}

const filename = 'myFile.html'

// read the file
fs.readFile(path.join(dirs.input, filename), 'utf8', (err, data) => {

    // pass to jsdom
    jsdom.env(data, (jsdomErr, window) => {
        if (jsdomErr) throw jsdomErr

        // run segment
        let segment = new htmlSegment(window.document)

        // an example of something you can do with the segment object
        // this will output all of the section ids that segment creates
        segment.sections.map((section) => console.log(section.getAttribute('id')))

        // write the result to a new output file
        fs.writeFile(path.join(dirs.output, filename), window.document.documentElement.outerHTML, (writeErr) => {
            if (writeErr) throw writeErr
        })
    })
})
```
