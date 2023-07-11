import XMLSchemata from '../lib/XMLSchemata.js';
import { v4 as uuidv4 } from 'uuid';

export class ProbeBuilder {
    readonly message_id: string;
    readonly message: string;
    readonly xs: any;
	private _types: string[];

	constructor(xs: any, types: string[] = []) {
		this.xs = xs;
		this.message_id = `uuid:${uuidv4()}`;
		this._types = types;
		this.message = this.build_probe();
	}

	get types() {
		return this._types;
	}

	toString(): any {
		return this.message;
	}

	private build_header() {
		const fields = [];
		const { xs, message_id } = this;
		//const must = { mustUnderstand: true };
		fields.push({ MessageID: message_id });
		fields.push({ To: 'urn:schemas-xmlsoap-org:ws:2005:04:discovery' });
		fields.push({ Action: 'http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe' });

		const header_fields = fields.map((field) => xs.stringify(field, {}, true));
		return XMLSchemata.any(header_fields.join(""), {});
	}

	private build_body() {
		const { xs } = this;
		const type_list = this.types.join('  ');
		const types = xs.stringify({ Types: type_list }, {}, true);
		const body = {
			Probe: XMLSchemata.any(types, {})
		};
		const body_xml = xs.stringify(body, {}, true);	
		return XMLSchemata.any(body_xml, {});
	}

	private build_probe() {
		const message = { 
			Envelope: {
				Header: this.build_header(),
				Body: this.build_body()
			}
		};
		return this.xs.stringify(message);
	}
}