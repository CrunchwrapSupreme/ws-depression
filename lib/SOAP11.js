import fs from 'fs';
import path from 'path';
import XMLSchemata from './XMLSchemata.js';
import XMLReader from './XMLReader.js';
import XMLNode from './XMLNode.js';
import SOAPFault from './SOAPFault.js';

const WSDL = { namespaceURI: 'http://schemas.xmlsoap.org/wsdl/' };

const _contentType = 'text/xml';

let _xs = null;

const get_xs = () => {
  if (_xs === null) _xs = new XMLSchemata(path.join(path.dirname(module.filename), 'soap-1.1.xsd'));

  return _xs;
};

const _fault_xml = ({ code, message, actor, detail }) => {
  if (typeof code === 'string') code = { localName: code, namespaceURI: 'http://schemas.xmlsoap.org/soap/envelope/' };

  const Fault = {
    faultstring: message,
    faultcode: code,
    faultactor: actor,
    detail
  };

  return get_xs().stringify({ Fault });
};

const _message = (body, header, o) => {
  if (!Array.isArray(body)) body = [body, {}];

  if (body[0] instanceof SOAPFault) body[0] = _fault_xml(body[0]);

  const Envelope = { Body: XMLSchemata.any(body) };

  if (header != null) Envelope.Header = XMLSchemata.any(header);

  return get_xs().stringify({ Envelope }, o);
};

 class SOAP11 {
  constructor (fn) {
    this.definitions = [];

    if (fn) {
      this.xs = new XMLSchemata(fn);

      for (const doc of this.xs.documents) {
        if (doc.localName === 'definitions' && doc.namespaceURI === WSDL.namespaceURI) { this.definitions.push(doc); }
      }
    }
  }

  getMessageLocalNameByElementLocalName (elementLocalName) {
    for (const d of this.definitions) {
      for (const m of d.children) {
        if (m.localName === 'message') {
          for (const p of m.children) {
            if (p.localName === 'part') {
              if (XMLNode.getLocalName(p.attributes.get('element')) === elementLocalName) { return m.attributes.get('name'); }
            }
          }
        }
      }
    }
  }

  getOperationNameByMessageLocalName (messageLocalName) {
    for (const d of this.definitions) {
      for (const p of d.children) {
        if (p.localName === 'portType') {
          for (const o of p.children) {
            if (o.localName === 'operation') {
              for (const i of o.children) {
                if (i.localName === 'input') {
                  if (XMLNode.getLocalName(i.attributes.get('message')) === messageLocalName) { return o.attributes.get('name'); }
                }
              }
            }
          }
        }
      }
    }
  }

  getSoapActionByOperationName (operationName) {
    for (const d of this.definitions) {
      for (const b of d.children) {
        if (b.localName === 'binding') {
          for (const o of b.children) {
            if (o.localName === 'operation' && o.attributes.get('name') === operationName) {
              for (const so of o.children) {
                if (o.localName === 'operation') { return so.attributes.get('soapAction'); }
              }
            }
          }
        }
      }
    }
  }

  getSoapActionByElementLocalName (elementLocalName) {
    return this.getSoapActionByOperationName(

      this.getOperationNameByMessageLocalName(

        this.getMessageLocalNameByElementLocalName(elementLocalName)

      )

    );
  }

  http (body, header) {
    if (!Array.isArray(body)) body = [body, {}];

    const encoding = 'UTF-8';

    const headers = { 'Content-Type': _contentType + '; charset=' + encoding.toLowerCase() };

    for (const elementLocalName in body[0]) {
      const SOAPAction = this.getSoapActionByElementLocalName(elementLocalName);

      if (SOAPAction) headers.SOAPAction = SOAPAction;
    }

    body[0] = this.xs.stringify(body[0]);

    return {
      method: 'POST',
      headers,
      body: _message(body, header, { declaration: { encoding } })
    };
  }
};

SOAP11.namespaceURI = 'http://schemas.xmlsoap.org/wsdl/soap/';
SOAP11.contentType = _contentType;

SOAP11.fromFile = async function (fn, options = {}) {
  const s = new SOAP11();

  s.xs = await XMLSchemata.fromFile(fn);

  const nodes = new XMLReader({
    filterElements: e =>
      e.namespaceURI === WSDL.namespaceURI &&
      e.localName === 'definitions'
  }).process(fs.createReadStream(fn));

  for await (const node of nodes) s.definitions.push(node);

  return s;
};

SOAP11.message = _message;

export default SOAP11;
