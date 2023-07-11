import { RemoteInfo } from "node:dgram";

const NoneVal = null;
export type None = null;
export type Optional<T> = T | None;

export interface ObjectMessage {
    [attr: string]: ObjectMessage | String
}

function splim(v: string): string[] {
    return v.split(' ').map((v: string) => v.trim());
}

function dig<T, R=string>(root: ObjectMessage, path: string, defval: T): R | T {
    const attr_path = path.split('.');
    let node: any = root;
    
    for(const attr of attr_path) {
        if(attr in node) {
            node = node[attr];
        } else {
            return defval;
        }
    }

    return node;
}

/** 
* Deserialization type for ws-discovery ProbeMatch
*/
export class ProbeMatch {
    readonly raw: ObjectMessage;
    readonly remote: RemoteInfo;

    constructor(json_msg: ObjectMessage, remote: RemoteInfo) {
        this.raw = json_msg;
        this.remote = remote;
    }

    validMatch(origin_id: string, valid_types: string[] = []): boolean {
        let val = this.relates_to === origin_id
        val &&= this.to === "http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous";
        val &&= this.action === "http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches";
        val &&= valid_types.some(type => this.types.includes(type, 0));
        
        return val;
    }

    get action(): Optional<String> {
        return dig(this.raw, 'Header.Action', NoneVal)
    }

    get to(): Optional<String> {
        return dig(this.raw, 'Header.To', NoneVal);
    }

    get relates_to(): Optional<String> {
        return dig(this.raw, 'Header.RelatesTo', NoneVal);
    }

    get message_id(): Optional<String> {
        return dig(this.raw, 'Header.MessageID', NoneVal);
    }

    get types(): string[] {
        const types = dig(this.raw, 'Body.ProbeMatches.ProbeMatch.Types', '');
        return splim(types);
    }

    get scopes(): string[] {
        const scopes = dig(this.raw, 'Body.ProbeMatches.ProbeMatch.Scopes', '');
        return splim(scopes);
    }

    get transports(): string[] {
        const xaddrs = dig(this.raw, 'Body.ProbeMatches.ProbeMatch.XAddrs', '');
        return splim(xaddrs);
    }
}