const unified = require('unified')
const stream = require('unified-stream')
const markdown = require('remark-parse')
const remark2rehype = require('remark-rehype')
const prism = require('@mapbox/rehype-prism')
const doc = require('rehype-document')
const format = require('rehype-format')
const html = require('rehype-stringify')

const processor = unified()
	.use(markdown)
	.use(remark2rehype)
	.use(prism)
	.use(doc, {
		title: 'Code Class IndexedDB',
		css: 'index.css',
		js: 'https://cdn.jsdelivr.net/npm/idb@2.1.3/lib/idb.min.js',
	})
	.use(format)
	.use(html)

process.stdin
	.pipe(stream(processor))
	.pipe(process.stdout)
