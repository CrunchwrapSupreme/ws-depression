import { RemoteInfo } from "node:dgram";
import { AnonAddress, ProbeMatchAction } from "./constants";

export interface MessageObject {
    [attr: string]: MessageObject | String
}

function splim(v: string): string[] {
    return v.split(' ').map((v: string) => v.trim());
}

function dig<T, R=string>(root: MessageObject, path: string, defval: T): R | T {
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
    readonly raw: MessageObject;
    readonly remote: RemoteInfo;

    constructor(json_msg: MessageObject, remote: RemoteInfo) {
        this.raw = json_msg;
        this.remote = remote;
    }

    validMatch(origin_id: string, valid_types: string[] = []): boolean {
        let val = this.relates_to === origin_id
        val &&= this.to === AnonAddress;
        val &&= this.action === ProbeMatchAction;
        val &&= valid_types.length == 0 || valid_types.some(type => this.types.includes(type, 0));
        
        return val;
    }

    get action(): String {
        return dig(this.raw, 'Header.Action', '')
    }

    get to(): String {
        return dig(this.raw, 'Header.To', '');
    }

    get relates_to(): String {
        return dig(this.raw, 'Header.RelatesTo', '');
    }

    get message_id(): String {
        return dig(this.raw, 'Header.MessageID', '');
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