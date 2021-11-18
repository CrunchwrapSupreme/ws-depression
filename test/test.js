const fs = require ('fs')
const assert = require ('assert')
const {XMLEventEmitter, XMLLexer, Attributes} = require ('../')

async function test_001_lexer_sync (fn) {

	const xml = fs.readFileSync (
		'test/' + fn
//		, 'utf-8'
	)
	
console.log (xml)

	const lexer = new XMLLexer ({
//		maxLength: 40,
//		encoding: 'ascii',
	})

	lexer.on ('data', data => console.log (new Attributes (data)))
	
//	for (let c of xml) lexer.write (c); lexer.end ()
//	for (let c of xml) lexer.write (Buffer.from ([c])); lexer.end ()

	lexer.end (xml)

}

async function test_002_lexer_stream (fn) {

	const is = fs.createReadStream ('test/' + fn, {
//		encoding: 'utf8',
	})
	
	const lexer = new XMLLexer ({
//		maxLength: 40,
//		encoding: 'ascii',
	})

	is.pipe (lexer)
	
	for await (const i of lexer) 
//	if (/^<PARAMTYPE /.test (i)) 
	{
		console.log ({i})
	
//		let a = new Attributes (i)

//		console.log (a.asObject ())
		
//		for (let j of a) console.log (j)

	}

}


async function test_003_emitter_sync (fn) {

	const xml = fs.readFileSync (
		'test/' + fn
//		, 'utf-8'
	)
	
console.log (xml)

	const lex = new XMLLexer ({
//		maxLength: 40,
//		encoding: 'ascii',
		stripSpace: true,
	})

	const sax = new XMLEventEmitter ({})

	lex.pipe (sax)

	for (let event of [
		'StartDocument',
		'ProcessingInstruction',
		'Comment',
		'DTD',
		'StartElement',
		'Characters',
		'EndElement',
		'EndDocument',
	]) sax.on (event, data => console.log ([event, data]))

//	lexer.on ('data', data => console.log ({data}))
	
//	for (let c of xml) lexer.write (c); lexer.end ()
//	for (let c of xml) lexer.write (Buffer.from ([c])); lexer.end ()

	lex.end (xml)

}

async function main () {

//	await test_001_lexer_sync ('E05a.xml')
//	await test_001_lexer_sync ('not-sa01.xml')
//	await test_001_lexer_sync ('not-sa02.xml')
	await test_001_lexer_sync ('param_types.xml')
//	await test_002_lexer_stream ('E05a.xml')
//	await test_002_lexer_stream ('param_types.xml')
//	await test_002_lexer_stream ('not-sa02.xml')
//	await test_003_emitter_sync ('E05a.xml')
//	await test_003_emitter_sync ('param_types.xml')
//	await test_003_emitter_sync ('not-sa01.xml')

}

main ()
