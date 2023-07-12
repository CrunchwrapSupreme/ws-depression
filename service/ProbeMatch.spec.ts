import { ProbeMatch } from "./ProbeMatch";
import { describe, expect, test, jest } from "@jest/globals";
import { AnonAddress, ProbeMatchAction } from "./constants";
import { v4 } from "uuid";
import { video_transmitter } from "./device_types";
import { RemoteInfo } from "dgram";
const origin = v4();
const scopes = ['scope1', 'scope2'];
const types = [video_transmitter];
const transports = ['10.0.0.45'];
const messageID = v4();

const remoteFixture: RemoteInfo = { 
    address: '10.0.0.45', 
    family: 'IPv6',
    port: 1000, 
    size: 1000 
};
const probeMatch = new ProbeMatch({
    Header: {
        Action: ProbeMatchAction,
        To: AnonAddress,
        RelatesTo: origin,
        MessageID: messageID
    },
    Body: {
        ProbeMatches: {
            ProbeMatch: {
                Types: types.join(' '),
                Scopes: scopes.join(' '),
                XAddrs: transports.join(' ')
            }
        }
    }
}, remoteFixture);

describe("ProbeMatch", () => {
    test('valid match', () => {
        expect(probeMatch.action).toEqual(ProbeMatchAction);
        expect(probeMatch.to).toEqual(AnonAddress);
        expect(probeMatch.action).toEqual(ProbeMatchAction);
        expect(probeMatch.message_id).toEqual(messageID);
        expect(probeMatch.types).toEqual(types);
        expect(probeMatch.scopes).toEqual(scopes);
        expect(probeMatch.transports).toEqual(transports);
        expect(probeMatch.validMatch(origin, types)).toEqual(true);
    });

    describe('invalid match', () => {
        test('mismatched origin', () => {
            jest.spyOn(probeMatch, 'relates_to', 'get').mockReturnValue('garbo');
            expect(probeMatch.validMatch(origin, types)).toEqual(false);
        });

        test('mismatched address', () => {
            jest.spyOn(probeMatch, 'to', 'get').mockReturnValue('garbo');
            expect(probeMatch.validMatch(origin, types)).toEqual(false);
        });

        test('mismatched action', () => {
            jest.spyOn(probeMatch, 'action', 'get').mockReturnValue('garbo');
            expect(probeMatch.validMatch(origin, types)).toEqual(false);
        });

        test('mismatched types', () => {
            jest.spyOn(probeMatch, 'types', 'get').mockReturnValue(['garbo']);
            expect(probeMatch.validMatch(origin, types)).toEqual(false);
        });
    })
});

