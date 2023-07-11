import XMLSchemata from '../lib/XMLSchemata.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Helper type for deserialization a ws-discovery Probe message
 */
export class ProbeBuilder {
    readonly message_id: string;
    readonly message: string;
    readonly types: string[];
    private readonly xs: XMLSchemata;

    constructor(xs: XMLSchemata, types: string[] = []) {
        this.xs = xs;
        this.message_id = `uuid:${uuidv4()}`;
        this.types = types;
        this.message = this.build_probe();
    }

    private build_header() {
        const fields = [];
        const { xs, message_id } = this;
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

    private build_probe(): string {
        const message = { 
            Envelope: {
                Header: this.build_header(),
                Body: this.build_body()
            }
        };
        const probe_msg = this.xs.stringify(message);
        if(!probe_msg) {
            throw new Error("Could not construct probe message?");
        } else {
            return probe_msg
        }
    }
}