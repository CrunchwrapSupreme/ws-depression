const assert     = require ('assert')

const CH_LT          = '<'.charCodeAt (0)
const CH_EXCLAMATION = '!'.charCodeAt (0)
const CH_QUESTION    = '?'.charCodeAt (0)
const CH_SLASH       = '/'.charCodeAt (0)
const CH_MINUS       = '-'.charCodeAt (0)

const STR_XML        = 'XML'
const STR_CDATA      = '[CDATA['
const STR_DOCTYPE    = 'DOCTYPE'

const START_DOCUMENT         = 'StartDocument'
const PROCESSING_INSTRUCTION = 'ProcessingInstruction'
const COMMENT                = 'Comment'
const DTD                    = 'DTD'
const START_ELEMENT          = 'StartElement'
const CHARACTERS             = 'Characters'
const END_ELEMENT            = 'EndElement'
const END_DOCUMENT           = 'EndDocument'
const CDATA                  = 'CDATA'

const SAXEvent = class {

	constructor (src) {

		this.src        = src
		
		this._afterName = 0

	}

	get type () {
	
		const {src} = this

		switch (src.charCodeAt (0)) {

			case CH_LT:

				switch (src.charCodeAt (1)) {

					case CH_SLASH: 

						return END_ELEMENT

					case CH_QUESTION: 

						switch (src.slice (2, 5).toLowerCase ()) {

							case STR_XML: return START_DOCUMENT

							default: return PROCESSING_INSTRUCTION

						}

					case CH_EXCLAMATION:

						if (src.charCodeAt (2) === CH_MINUS) return COMMENT

						switch (src.slice (2, 9)) {					

							case STR_CDATA: return CDATA

							case STR_DOCTYPE: return DTD

							default: return null

						}

					default: return START_ELEMENT

				}

				break

			default:

				return CHARACTERS

		}

	}
	
	get text () {

		const {src} = this

		switch (src.charCodeAt (0)) {

			case CH_LT: return src.slice (9, -3)
			
			default: return src
			
		}

	}

	get attributes () {
	
		const m = new Map ()
		
		this.writeAttributesToMap (m)
		
		return m
	
	}
	
	writeAttributesToMap (m) {
	
		const {src} = this

		let start = this._afterName; while (true) {

			const eq = src.indexOf ('=', start); if (eq === -1) break

			const  q = src.indexOf (src.charAt (eq + 1), eq + 2); if (q === -1) break

			let k = src.slice (start, eq)
			
			if (start === 0) {
			
				let p = k.length - 2; while (p !== 0 && k.charCodeAt (p) <= 32) p --

				k = k.slice (this._afterName = p)

			}
			else {
			
				k = k.trim ()
			
			}			

			m.set (k, src.slice (eq + 2, q))

			start = q + 1
		
		}
		
		return m
	
	}
	
	get isSelfEnclosed () {

		const {src} = this

		return src.charCodeAt (src.length - 2) === CH_SLASH
	
	}

}

SAXEvent.TYPES = {
	START_DOCUMENT,
	PROCESSING_INSTRUCTION,
	COMMENT,
	DTD,
	START_ELEMENT,
	CHARACTERS,         
	END_ELEMENT,
	END_DOCUMENT,
	CDATA,
}

module.exports = SAXEvent