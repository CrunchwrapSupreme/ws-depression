import assert from 'assert';
import * as NSMap from './NamespacesMap.js'

const DEFAULTS = [
  [NSMap.XMLNamespace, NSMap.XMLNamespacePrefix],
  [NSMap.XMLSchemaNamespace, NSMap.XMLSchemaNamespacePrefix]
];

class NamespacePrefixesMap extends Map {
  constructor (schemata) {
    super(DEFAULTS);

    for (const uri of schemata.keys()) { this.set(uri, 'ns' + this.size); }
  }

  QName (localName, namespaceURI) {
    if (namespaceURI == null) return localName;

    assert(this.has(namespaceURI), 'Unknown target namespace: ' + namespaceURI);

    return this.get(namespaceURI) + ':' + localName;
  }

  toString () {
    let s = '';

    for (const [k, v] of this.entries()) if (k !== NSMap.XMLNamespace) s += ' xmlns:' + v + '="' + k + '"';

    return s;
  }
};

export default NamespacePrefixesMap;
