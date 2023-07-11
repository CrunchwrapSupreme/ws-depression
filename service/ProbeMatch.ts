function splim(v: string) {
	return v.split(' ').map((v: string) => v.trim());
}

// Deserialization type for ProbeMatch
export class ProbeMatch {
    readonly raw: any;

	constructor(json_msg: any) {
		this.raw = json_msg;
	}

	validMatch(origin_id: string, valid_types: string[] = []): boolean {
		const { RelatesTo, To, Action } = this.raw?.Header;
		let val = origin_id == RelatesTo;
		val &&= To == "http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous";
		val &&= Action == "http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches";
		val &&= valid_types.every(type => this.types.includes(type, 0));
		
		return val;
	}

	get message_id(): string {
		return this.raw.Header.MessageID;
	}

	get types(): string[] {
		return splim(this.raw.Body.ProbeMatches.ProbeMatch.Types);
	}

	get scopes(): string[] {
		return splim(this.raw.Body.ProbeMatches.ProbeMatch.Scopes);
	}

	get endpointAddress(): string {
		return this.raw.Body.EndpointReference.Address;
	}

	get transports(): null | string {
		const xaddrs = this.raw.Body.ProbeMatches.ProbeMatch?.XAddrs;
		
		if(xaddrs) {
			return xaddrs.split(" ").map((v: string) => v.trim());
		} else {
            return null;
        }
	}
}